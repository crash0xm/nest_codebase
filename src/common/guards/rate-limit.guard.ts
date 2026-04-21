import { Injectable, CanActivate, ExecutionContext, HttpResponse } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from '@/common/services/logger.service';
import { ApplicationError } from '@/common/domain/errors/application.error';

interface RateLimitRequest {
  user?: { id: string };
  ip?: string;
  connection?: { remoteAddress?: string };
  socket?: { remoteAddress?: string };
  path: string;
  method: string;
  headers: Record<string, unknown>;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitInfo {
  totalHits: number;
  remainingHits: number;
  resetTime: Date;
  windowMs: number;
}

export interface RateLimitStore {
  increment: (key: string, options: RateLimitOptions) => RateLimitInfo;
  reset: (key: string) => void;
  cleanup: () => void;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store: RateLimitStore;
  private readonly defaultOptions: RateLimitOptions;

  constructor(
    private readonly reflector: Reflector,
    _configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.store = new MemoryRateLimitStore(logger);
    this.defaultOptions = {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      message: 'Too many requests, please try again later.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    };
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    try {
      // Get rate limit options from metadata
      const options = this.getRateLimitOptions(context);

      // Generate key for rate limiting
      const key = this.generateKey(request, options);

      // Check rate limit
      const rateLimitInfo = this.store.increment(key, options);

      // Add rate limit headers
      this.addRateLimitHeaders(response, rateLimitInfo);

      // Check if rate limit exceeded
      if (rateLimitInfo.totalHits > options.max) {
        this.logger.security('Rate limit exceeded', {
          key,
          totalHits: rateLimitInfo.totalHits,
          max: options.max,
          windowMs: options.windowMs,
          path: request.path,
          method: request.method,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        });

        throw new ApplicationError('Too many requests', 'RATE_LIMIT_EXCEEDED', 429, {
          key,
          totalHits: rateLimitInfo.totalHits,
          remainingHits: rateLimitInfo.remainingHits,
          resetTime: rateLimitInfo.resetTime,
        });
      }

      // Log rate limit info
      this.logger.http(`Rate limit check passed`, {
        key,
        totalHits: rateLimitInfo.totalHits,
        remainingHits: rateLimitInfo.remainingHits,
        path: request.path,
        method: request.method,
      });

      return true;
    } catch (error) {
      this.logger.errorWithException('Rate limit guard error', error as Error, undefined, {
        path: request.path,
        method: request.method,
        ip: request.ip,
      });

      throw error;
    }
  }

  private getRateLimitOptions(_context: ExecutionContext): RateLimitOptions {
    const customOptions = this.reflector.get<Partial<RateLimitOptions>>(
      'rateLimit',
      _context.getHandler(),
    );

    return {
      ...this.defaultOptions,
      ...(customOptions ?? {}),
    };
  }

  private generateKey(request: RateLimitRequest, _options: RateLimitOptions): string {
    const userId = request.user?.id;
    const ip = request.ip ?? request.connection?.remoteAddress ?? request.socket?.remoteAddress;
    const endpoint = request.path;

    if (userId) {
      return `rate_limit:user:${userId}:${endpoint}`;
    } else if (ip) {
      return `rate_limit:ip:${ip}:${endpoint}`;
    } else {
      return `rate_limit:global:${endpoint}`;
    }
  }

  private addRateLimitHeaders(response: HttpResponse, rateLimitInfo: RateLimitInfo): void {
    response.setHeader('X-RateLimit-Limit', rateLimitInfo.windowMs);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitInfo.remainingHits));
    response.setHeader('X-RateLimit-Reset', rateLimitInfo.resetTime.toISOString());
  }
}

// Memory-based rate limit store
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitInfo>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private readonly logger: AppLoggerService) {
    this.cleanupInterval = setInterval(
      (): void => {
        this.cleanup();
      },
      5 * 60 * 1000,
    );
  }

  increment(key: string, options: RateLimitOptions): RateLimitInfo {
    const now = Date.now();
    const resetTime = new Date(now + options.windowMs);

    let entry = this.store.get(key);

    if (!entry) {
      entry = {
        totalHits: 1,
        remainingHits: options.max - 1,
        resetTime,
        windowMs: options.windowMs,
      };
    } else {
      if (now > entry.resetTime.getTime()) {
        entry = {
          totalHits: 1,
          remainingHits: options.max - 1,
          resetTime,
          windowMs: options.windowMs,
        };
      } else {
        entry.totalHits++;
        entry.remainingHits = Math.max(0, options.max - entry.totalHits);
      }
    }

    this.store.set(key, entry);

    return entry;
  }

  reset(key: string): void {
    this.store.delete(key);

    this.logger.http(`Rate limit reset for key: ${key}`, {
      key,
    });
  }

  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime.getTime()) {
        this.store.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.http(`Rate limit cleanup completed`, {
        cleanedCount,
        remainingEntries: this.store.size,
      });
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.store.clear();

    this.logger.http('Rate limit store destroyed');
  }
}

// Decorator for setting rate limit options
export const RateLimit =
  (options: Partial<RateLimitOptions>) =>
  (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    Reflect.defineMetadata('rateLimit', options, descriptor.value);
    return descriptor;
  };

// Redis-based rate limit store (for production)
export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly redis: { pipeline: () => unknown; del: (key: string) => Promise<void> },
    private readonly logger: AppLoggerService,
  ) {}

  increment(key: string, options: RateLimitOptions): RateLimitInfo {
    const now = Date.now();
    const resetTime = now + options.windowMs;

    const pipeline = this.redis.pipeline();
    (pipeline as { incr: (key: string) => void; expire: (key: string, ttl: number) => void }).incr(
      key,
    );
    (
      pipeline as { incr: (key: string) => void; expire: (key: string, ttl: number) => void }
    ).expire(key, Math.ceil(options.windowMs / 1000));

    return {
      totalHits: 1,
      remainingHits: Math.max(0, options.max - 1),
      resetTime: new Date(resetTime),
      windowMs: options.windowMs,
    };
  }

  reset(key: string): void {
    void this.redis.del(key);

    this.logger.http(`Rate limit reset for key: ${key}`, {
      key,
    });
  }

  cleanup(): void {
    // Redis handles expiration automatically
  }
}
