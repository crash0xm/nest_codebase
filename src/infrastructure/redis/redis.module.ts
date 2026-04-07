import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const Redis = require('ioredis');
        return new Redis({
          host: config.get('cache.redis.host'),
          port: config.get('cache.redis.port'),
          password: config.get('cache.redis.password') || undefined,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
          retryDelayOnFailover: 100,
          maxLoadingTimeout: 5000,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
