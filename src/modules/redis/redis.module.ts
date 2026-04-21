import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService): Redis => {
        return new Redis({
          host: config.get<string>('cache.redis.host') ?? 'localhost',
          port: config.get<number>('cache.redis.port') ?? 6379,
          password: config.get<string>('cache.redis.password') ?? undefined,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,

        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
