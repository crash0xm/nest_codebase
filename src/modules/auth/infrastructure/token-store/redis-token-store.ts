import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as argon2 from 'argon2';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis.module';

export interface ITokenStore {
  save(
    userId: string,
    tokenId: string,
    tokenHash: string,
    ttlSeconds: number,
  ): Promise<void>;
  verify(userId: string, tokenId: string, token: string): Promise<boolean>;
  revoke(userId: string, tokenId: string): Promise<void>;
  revokeAll(userId: string): Promise<void>;
  blacklistAccessToken(jti: string, ttlSeconds: number): Promise<void>;
  isAccessTokenBlacklisted(jti: string): Promise<boolean>;
}

@Injectable()
export class RedisTokenStore implements ITokenStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisTokenStore.name);
  private readonly redis: Redis;
  private readonly redisTokenStore: Redis;
  private readonly keyPrefix: string;
  private readonly MAX_ACTIVE_SESSIONS = 5;

  constructor(
    configService: ConfigService,
    @Inject(REDIS_CLIENT) redisClient: Redis,
  ) {
    this.keyPrefix = configService.get<string>('cache.keyPrefix') || 'cache:';
    this.redis = redisClient;
    
    // Create separate Redis instance for token store with different DB
    this.redisTokenStore = redisClient.duplicate();
    this.redisTokenStore.select(1); // separate DB from auth/tokens

    this.redisTokenStore.on('error', (err: Error) => {
      this.logger.error('Redis token store error:', err.message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisTokenStore.quit();
  }

  async save(
    userId: string,
    tokenId: string,
    token: string,
    ttlSeconds: number,
  ): Promise<void> {
    const key = this.refreshKey(userId, tokenId);
    const sessionsKey = this.userSessionsKey(userId);
    const tokenHash = await argon2.hash(token);

    const multi = this.redisTokenStore.multi();

    // Store the hashed token
    multi.setex(key, ttlSeconds, tokenHash);

    // Add to session tracker (sorted set by timestamp)
    multi.zadd(sessionsKey, Date.now(), tokenId);

    await multi.exec();

    // Check and prune old sessions
    const sessionCount = await this.redisTokenStore.zcard(sessionsKey);
    if (sessionCount > this.MAX_ACTIVE_SESSIONS) {
      const toRemove = await this.redisTokenStore.zrange(
        sessionsKey,
        0,
        sessionCount - this.MAX_ACTIVE_SESSIONS - 1,
      );
      if (toRemove.length > 0) {
        this.logger.log(
          `Pruning ${toRemove.length} old sessions for user ${userId}`,
        );
        const pruneMulti = this.redisTokenStore.multi();
        for (const tid of toRemove) {
          pruneMulti.del(this.refreshKey(userId, tid));
        }
        pruneMulti.zrem(sessionsKey, ...toRemove);
        await pruneMulti.exec();
      }
    }
  }

  async verify(
    userId: string,
    tokenId: string,
    token: string,
  ): Promise<boolean> {
    const key = this.refreshKey(userId, tokenId);
    const storedHash = await this.redisTokenStore.get(key);

    if (!storedHash) return false;

    return argon2.verify(storedHash, token);
  }

  async revoke(userId: string, tokenId: string): Promise<void> {
    const key = this.refreshKey(userId, tokenId);
    const sessionsKey = this.userSessionsKey(userId);

    const multi = this.redisTokenStore.multi();
    multi.del(key);
    multi.zrem(sessionsKey, tokenId);

    const results = await multi.exec();
    const deletedCount = results?.[0]?.[1] as number;

    if (deletedCount === 0) {
      this.logger.warn(
        `[TOKEN REUSE/REVOKED] Potential reuse or invalid revoke: userId=${userId} tokenId=${tokenId}`,
      );
    }
  }

  async revokeAll(userId: string): Promise<void> {
    const sessionsKey = this.userSessionsKey(userId);
    const sessionIds = await this.redisTokenStore.zrange(sessionsKey, 0, -1);

    if (sessionIds.length > 0) {
      const multi = this.redisTokenStore.multi();
      for (const tid of sessionIds) {
        multi.del(this.refreshKey(userId, tid));
      }
      multi.del(sessionsKey);
      await multi.exec();
    }

    this.logger.log(`Revoked all sessions for user ${userId}`);
  }

  async blacklistAccessToken(jti: string, ttlSeconds: number): Promise<void> {
    const key = `${this.keyPrefix}blacklist:${jti}`;
    await this.redisTokenStore.setex(key, ttlSeconds, '1');
  }

  async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    const key = `${this.keyPrefix}blacklist:${jti}`;
    return (await this.redisTokenStore.exists(key)) === 1;
  }

  private refreshKey(userId: string, tokenId: string): string {
    return `refresh:${userId}:${tokenId}`;
  }

  private userSessionsKey(userId: string): string {
    return `sessions:${userId}`;
  }

  private blacklistKey(jti: string): string {
    return `blacklist:${jti}`;
  }
}
