import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/modules/redis/redis.module';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
  priority?: number; // Priority for cache eviction
}

export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  ttl: number;
  tags?: string[];
  priority: number;
  hits: number;
}

export interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
}

@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.cacheManager.get<T>(key);
    if (value === undefined || value === null) return null;
    return value;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttlMs);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async setWithTag<T>(key: string, value: T, tag: string, ttlMs?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttlMs);

    const tagKey = `tag:${tag}`;
    const ttlSeconds = ttlMs ? Math.ceil(ttlMs / 1000) : 3600;
    await this.redis.sadd(tagKey, key);
    await this.redis.expire(tagKey, ttlSeconds);
  }

  async invalidateByTag(tag: string): Promise<void> {
    const tagKey = `tag:${tag}`;
    const keys: string[] = [];

    let cursor = '0';
    do {
      const [nextCursor, members] = await this.redis.sscan(tagKey, cursor, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...members);
    } while (cursor !== '0');

    if (keys.length === 0) return;

    const pipeline = this.redis.pipeline();
    for (const key of keys) {
      pipeline.del(key);
    }
    pipeline.del(tagKey);
    await pipeline.exec();
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, found] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...found);
    } while (cursor !== '0');

    if (keys.length === 0) return;

    const pipeline = this.redis.pipeline();
    for (const key of keys) {
      pipeline.del(key);
    }
    await pipeline.exec();
  }
}
