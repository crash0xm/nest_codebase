import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AppLoggerService, LogMetadata } from '@/common/services/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    const { method, url, ip, headers } = request;
    const requestId = headers['x-request-id'] as string | undefined;
    const traceId = headers['x-trace-id'] as string | undefined;
    const userAgent = headers['user-agent'];

    // Extract user info if available (from auth middleware)
    const { user } = request as any;
    const userId = user?.id;
    const sessionId = user?.sessionId;

    const metadata: LogMetadata = {
      requestId,
      traceId,
      userId,
      sessionId,
      method,
      url,
      ip,
      userAgent,
    };

    return next.handle().pipe(
      tap(() => {
        // Log successful request
        const endTime = Date.now();
        const duration = endTime - startTime;
        const { statusCode } = response;

        this.logger.logRequest(method, url, statusCode, duration, {
          ...metadata,
          statusCode,
          duration,
          success: statusCode < 400,
        });

        // Log performance for slow requests
        if (duration > 1000) {
          this.logger.performance(`${method} ${url}`, duration, startTime, endTime, {
            ...metadata,
            type: 'slow_request',
            threshold: 1000,
          });
        }
      }),
      catchError((error) => {
        // Log failed request
        const endTime = Date.now();
        const duration = endTime - startTime;

        this.logger.errorWithException(`Request failed: ${method} ${url}`, error, undefined, {
          ...metadata,
          duration,
          statusCode: error.status || 500,
        });

        return throwError(() => error);
      }),
    );
  }
}
