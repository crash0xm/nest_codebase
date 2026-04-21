import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppLoggerService } from '@/common/services/logger.service';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    role: string;
    sessionId?: string;
    lastLoginAt?: Date;
  };
  sessionId?: string;
  requestId?: string;
  traceId?: string;
}

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  sessionId?: string;
  lastLoginAt?: Date;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger: AppLoggerService;
  private readonly jwtService: JwtService;
  private readonly excludedPaths: string[];

  constructor(
    private readonly configService: ConfigService,
    logger: AppLoggerService,
    jwtService: JwtService,
  ) {
    this.logger = logger;
    this.jwtService = jwtService;

    this.excludedPaths = [
      '/health',
      '/metrics',
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/docs',
      '/swagger',
    ];
  }

  async use(req: AuthenticatedRequest, res: FastifyReply, next: () => void): Promise<void> {
    const startTime = Date.now();

    try {
      this.addCorrelationIds(req);

      if (this.isExcludedPath(req.url)) {
        this.logger.http(`Skipping authentication for excluded path: ${req.url}`, {
          requestId: req.requestId,
          traceId: req.traceId,
          path: req.url,
          method: req.method,
        });

        req.user = undefined;
        return next();
      }

      const token = this.extractToken(req);

      if (!token) {
        this.logger.security('No authentication token provided', {
          requestId: req.requestId,
          traceId: req.traceId,
          path: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        req.user = undefined;
        return next();
      }

      const payload = await this.validateToken(token);

      if (!payload) {
        this.logger.security('Invalid authentication token', {
          requestId: req.requestId,
          traceId: req.traceId,
          path: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          token: `${token.substring(0, 20)}...`,
        });

        req.user = undefined;
        return next();
      }

      if (!payload.isActive) {
        this.logger.security('Inactive user attempted access', {
          requestId: req.requestId,
          traceId: req.traceId,
          path: req.url,
          method: req.method,
          ip: req.ip,
          userId: payload.id,
          email: payload.email,
        });

        req.user = undefined;
        return next();
      }

      req.user = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sessionId,
        lastLoginAt: payload.lastLoginAt,
      };

      const duration = Date.now() - startTime;
      this.logger.auth(`User authenticated successfully`, {
        requestId: req.requestId,
        traceId: req.traceId,
        userId: payload.id,
        email: payload.email,
        role: payload.role,
        duration,
        path: req.url,
        method: req.method,
        ip: req.ip,
      });

      this.addSecurityHeaders(res);

      next();
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.errorWithException(
        'Authentication middleware error',
        error instanceof Error ? error : new Error(String(error)),
        undefined,
        {
          requestId: req.requestId,
          traceId: req.traceId,
          path: req.url,
          method: req.method,
          duration,
          ip: req.ip,
        },
      );

      req.user = undefined;
      next();
    }
  }

  private addCorrelationIds(req: AuthenticatedRequest): void {
    req.requestId =
      (req.headers['x-request-id'] as string) ??
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    req.traceId =
      (req.headers['x-trace-id'] as string) ??
      `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isExcludedPath(path: string): boolean {
    return this.excludedPaths.some(
      (excludedPath) => path.startsWith(excludedPath) || path === excludedPath,
    );
  }

  private extractToken(req: AuthenticatedRequest): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const cookies = req.headers.cookie;
    if (cookies && typeof cookies === 'string') {
      const tokenMatch = cookies.match(/auth-token=([^;]+)/);
      if (tokenMatch) {
        return tokenMatch[1];
      }
    }

    const query = req.query as Record<string, string | undefined>;
    const tokenQuery = query.token;
    if (tokenQuery) {
      return tokenQuery;
    }

    return null;
  }

  private async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get('auth.jwt.accessToken.secret'),
        algorithms: ['HS256'],
        clockTolerance: 30,
      });

      return payload;
    } catch (error) {
      this.logger.security('Token validation failed', {
        error: error instanceof Error ? error.message : String(error),
        token: `${token.substring(0, 20)}...`,
      });

      return null;
    }
  }

  private addSecurityHeaders(res: FastifyReply): void {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    const corsOrigin = this.configService.get<string>('app.corsOrigin');
    if (corsOrigin && corsOrigin !== '*') {
      res.header('Access-Control-Allow-Origin', corsOrigin);
      res.header('Vary', 'Origin');
    }
  }
}
