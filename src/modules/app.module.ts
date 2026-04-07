import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { LoggerModule } from 'nestjs-pino';
import { redisStore } from 'cache-manager-redis-yet';
import { randomUUID } from 'crypto';
import { ConfigModule, ConfigService } from '@nestjs/config';
import appConfig from '@config/app/app.config';
import databaseConfig from '@config/database/database.config';
import redisConfig from '@config/redis/redis.config';
import authConfig from '@config/auth/auth.config';
import { AppClsModule } from '@modules/cls/cls.module';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';

import { HealthModule } from '@modules/health/health.module';
import { MetricsModule } from '@modules/metrics/metrics.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { AuthModule } from '@modules/auth/auth.module';
import { UserModule } from '@modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, authConfig],
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),

    AppClsModule,

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const level = config.get('logger.level');
        const redactPaths = config.get('logger.redactPaths') || [];
        const prettyPrint = config.get('logger.prettyPrint');

        return {
          pinoHttp: {
            level,
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'body.password',
              'body.secret',
              'body.token',
              'body.key',
              ...redactPaths,
            ],
            transport: prettyPrint
              ? {
                  target: 'pino-pretty',
                  options: { colorize: true, singleLine: true },
                }
              : undefined,
            genReqId: (req) =>
              (req.headers['x-request-id'] as string | undefined) ??
              randomUUID(),
          },
        };
      },
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          throttlers: [
            {
              ttl: 60000, // 1 minute default
              limit: 100, // 100 requests per minute default
            },
          ],
        };
      },
    }),

    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          connection: {
            host: config.get('redis.host'),
            port: config.get('redis.port'),
            password: config.get('redis.password') || undefined,
          },
        };
      },
    }),

    // ── Cache (Redis) ─────────────────────────────────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        return {
          store: await redisStore({
            socket: {
              host: config.get('redis.host'),
              port: config.get('redis.port'),
            },
            password: config.get('redis.password') || undefined,
          }),
          ttl: 60000, // 1 minute default
          keyPrefix: 'cache:',
        };
      },
    }),

    // ── Core Infrastructure ───────────────────────────────────────────────────
    PrismaModule,
    RedisModule,

    // ── Observability ─────────────────────────────────────────────────────────
    HealthModule,
    MetricsModule,

    // ── Feature Modules ───────────────────────────────────────────────────────
    AuthModule,
    UserModule,
    NotificationModule,
  ],
  providers: [
    // Apply ThrottlerGuard globally
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global exception filter
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },

    // Global logging interceptor
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
