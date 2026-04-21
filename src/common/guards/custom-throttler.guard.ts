import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest, FastifyReply } from 'fastify';
import type { ThrottlerConfig } from '@/config/throttler/throttler-config.type';

interface ClientRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class CustomThrottlerGuard implements CanActivate {
  private clientRecords = new Map<string, ClientRecord>();

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const throttlerConfig = this.configService.get<ThrottlerConfig>('throttler');

    if (!throttlerConfig) {
      // If no config, allow by default
      return true;
    }

    // Check whitelist
    const clientIp = this.getClientIp(request);
    if (throttlerConfig.whitelist.includes(clientIp)) {
      return true;
    }

    // Find endpoint-specific config
    const path = request.url;
    const endpointConfig = throttlerConfig.endpoints.find((endpoint) => {
      if (endpoint.pattern instanceof RegExp) {
        return endpoint.pattern.test(path);
      }
      return endpoint.pattern === path;
    });

    const limit = endpointConfig?.limit ?? throttlerConfig.default;
    const key = `${clientIp}:${request.method}:${path}`;

    // In-memory throttling (can be extended to Redis)
    const now = Date.now();
    let record = this.clientRecords.get(key);

    if (!record || record.resetTime < now) {
      record = {
        count: 1,
        resetTime: now + limit.ttl,
      };
      this.clientRecords.set(key, record);
      return true;
    }

    record.count++;

    if (record.count > limit.limit) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);

      // Set rate limit headers
      response.header('Retry-After', retryAfter.toString());
      response.header('X-RateLimit-Limit', limit.limit.toString());
      response.header('X-RateLimit-Remaining', Math.max(0, limit.limit - record.count).toString());
      response.header('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `You have exceeded the rate limit. Please try again after ${retryAfter} seconds.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getClientIp(request: FastifyRequest): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }

    return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
  }
}
