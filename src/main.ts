import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './modules/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLoggerService } from 'nestjs-pino';
import { InfrastructureError } from '@/common/domain/errors/infrastructure.error';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(PinoLoggerService));

  const configService = app.get(ConfigService);

  const port = configService.get<number>('app.port') ?? 3000;
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'api/v1';
  const nodeEnv = configService.get<string>('app.nodeEnv') ?? 'development';
  const shutdownTimeout = configService.get<number>('app.shutdownTimeout') ?? 30000;
  const apiVersion = configService.get<string>('app.apiVersion') ?? '1';

  const corsOrigins = configService.get<string[]>('security.cors.allowedOrigins') ?? [];
  if (corsOrigins.includes('*')) {
    throw new InfrastructureError(
      'CORS allowedOrigins cannot include "*" in production. Please specify explicit origins.',
      'CORS_WILDCARD_FORBIDDEN',
    );
  }
  const corsMethods = configService.get<string[]>('security.cors.allowedMethods') ?? ['GET'];
  const corsHeaders = configService.get<string[]>('security.cors.allowedHeaders') ?? [];
  const corsCredentials = configService.get<boolean>('security.cors.credentials') ?? false;
  const corsMaxAge = configService.get<number>('security.cors.maxAge') ?? 86400;

  const helmetCsp = configService.get<boolean>('security.helmet.contentSecurityPolicy') !== false;
  const helmetHsts = configService.get<boolean>('security.helmet.hsts') !== false;
  const helmetNoSniff = configService.get<boolean>('security.helmet.noSniff') !== false;

  // ── Fastify Helmet Plugin ─────────────────────────────────────────────────────
  await app.register(import('@fastify/helmet'), {
    contentSecurityPolicy: helmetCsp,
    hsts: helmetHsts ? { maxAge: 31536000, includeSubDomains: true } : false,
    noSniff: helmetNoSniff,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    crossOriginEmbedderPolicy: false,
  });

  // ── Fastify Compression Plugin ───────────────────────────────────────────────────
  await app.register(import('@fastify/compress'), {
    encodings: ['br', 'gzip', 'deflate'],
    threshold: 1024,
    customTypes: /^(image|audio|video|application\/zip|application\/gzip)/,
  });

  // ── CORS — strict origin matching ──────────────────────────────────────────
  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin)
      if (!origin) return callback(null, true);

      try {
        const url = new URL(origin);
        const isAllowed = corsOrigins.some((allowed) => {
          const allowedUrl = new URL(allowed);
          return (
            url.protocol === allowedUrl.protocol &&
            url.hostname === allowedUrl.hostname &&
            url.port === allowedUrl.port
          );
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin "${origin}" is not allowed`), false);
        }
      } catch {
        callback(new Error(`CORS: malformed origin "${origin}"`), false);
      }
    },
    methods: corsMethods,
    allowedHeaders: corsHeaders,
    credentials: corsCredentials,
    maxAge: corsMaxAge,
  });

  app.setGlobalPrefix(apiPrefix);

  // ── Global Pipes ────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Swagger ─────────────────────────────────────────────────────────────────
  if (nodeEnv === 'development' || nodeEnv === 'staging') {
    const doc = new DocumentBuilder()
      .setTitle('NestJS SaaS API')
      .setDescription('Enterprise-grade SaaS backend — full API reference')
      .setVersion(apiVersion)
      .addBearerAuth()
      .addServer(`http://localhost:${port}`, 'Local')
      .build();
    SwaggerModule.setup(`${apiPrefix}/docs`, app, SwaggerModule.createDocument(app, doc), {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`📚 Swagger: http://localhost:${port}/${apiPrefix}/docs`);
  }

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  app.enableShutdownHooks();
  let isClosing = false;

  const gracefulShutdown = (signal: string): void => {
    if (isClosing) {
      logger.warn(`[${signal}] Shutdown already in progress — ignoring duplicate signal`);
      return;
    }
    isClosing = true;

    logger.log(`[${signal}] Shutting down gracefully (timeout: ${shutdownTimeout}ms)...`);

    const forceExit = setTimeout(() => {
      logger.error('Forced shutdown after timeout — process.exit(1)');
      process.exit(1);
    }, shutdownTimeout);
    forceExit.unref();

    void app
      .close()
      .then(() => {
        logger.log('Application closed gracefully');
        clearTimeout(forceExit);
        process.exit(0);
      })
      .catch((err: unknown) => {
        logger.error('Error during graceful shutdown', err);
        process.exit(1);
      });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  await app.listen({ port, host: '0.0.0.0' });
  logger.log(`🚀 Running: http://localhost:${port}/${apiPrefix}`);
  logger.log(`🌍 Env: ${nodeEnv}`);

  if (nodeEnv === 'development' || nodeEnv === 'staging') {
    logger.log(`\n======================================================`);
    logger.log(`👉 📚 Swagger Docs: http://localhost:${port}/${apiPrefix}/docs`);
    logger.log(`======================================================\n`);
  }
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
