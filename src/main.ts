import { NestFactory } from '@nestjs/core';
import { Logger, VersioningType, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './modules/app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLoggerService } from 'nestjs-pino';

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
    throw new Error(
      'CORS allowedOrigins cannot include "*" in production. Please specify explicit origins.',
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
    encodings: ['gzip', 'deflate', 'br'],
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

  app.enableVersioning({ type: VersioningType.URI });

  // ── Global Pipes ────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Global Interceptors ─────────────────────────────────────────────────────
  app.useGlobalInterceptors(new ResponseInterceptor());

  // ── Swagger ─────────────────────────────────────────────────────────────────
  if (nodeEnv !== 'production') {
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
  (['SIGTERM', 'SIGINT'] as NodeJS.Signals[]).forEach((signal) => {
    process.on(signal, (): void => {
      logger.log(`[${signal}] Shutting down gracefully (${shutdownTimeout}ms)...`);
      setTimeout(() => process.exit(1), shutdownTimeout).unref();
      void app.close();
      process.exit(0);
    });
  });

  await app.listen({ port, host: '0.0.0.0' });
  logger.log(`🚀 Running: http://localhost:${port}/${apiPrefix}`);
  logger.log(`🌍 Env: ${nodeEnv}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
