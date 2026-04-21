import { Module } from '@nestjs/common';
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
import securityConfig from '@config/security/security.config';
import throttlerConfig from '@config/throttler/throttler.config';
import { AppClsModule } from '@modules/cls/cls.module';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { RedisModule } from '@modules/redis/redis.module';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';
import { CustomThrottlerGuard } from '@common/guards/custom-throttler.guard';
import { AuthGuard } from '@common/guards/auth.guard';
import { AuthorizationGuard } from '@common/guards/authorization.guard';
import { AppLoggerService } from '@common/services/logger.service';
import { ResourceOwnershipService } from '@common/services/resource-ownership.service';

import { HealthModule } from '@modules/health/health.module';
import { MetricsModule } from '@modules/metrics/metrics.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { AuthModule } from '@modules/auth/auth.module';
import { UserModule } from '@modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, authConfig, securityConfig, throttlerConfig],
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),

    AppClsModule,

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): object => {
        const level =
          config.get<string>('LOG_LEVEL') ?? config.get<string>('logger.level') ?? 'info';
        const redactPaths = config.get<string[]>('logger.redactPaths') ?? [];
        const prettyPrint = config.get<string>('logger.prettyPrint') !== 'false';

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
            genReqId: (req: { headers: Record<string, unknown> }): string =>
              (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
          },
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
      useFactory: (config: ConfigService): object => {
        return {
          connection: {
            host: config.get<string>('redis.host'),
            port: config.get<number>('redis.port'),
            password: config.get<string>('redis.password') ?? undefined,
          },
        };
      },
    }),

    // ── Cache (Redis) ─────────────────────────────────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<object> => {
        return {
          store: await redisStore({
            socket: {
              host: config.get<string>('redis.host'),
              port: config.get<number>('redis.port'),
            },
            password: config.get<string>('redis.password') ?? undefined,
          }),
          ttl: 60000,
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
    AppLoggerService,
    ResourceOwnershipService,

    // Rate limiting - custom guard with configurable limits
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },

    // Global authentication
    { provide: APP_GUARD, useClass: AuthGuard },

    // Global role + permission authorization
    { provide: APP_GUARD, useClass: AuthorizationGuard },

    // Exception filter
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },

    // Logging
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
