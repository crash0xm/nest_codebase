import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AppLoggerService, LogMetadata } from '@/common/services/logger.service';
import type { RequestWithUser } from '@/common/decorators/current-user.decorator';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    const { method, url, ip, headers } = request;
    const requestId = headers['x-request-id'] as string | undefined;
    const traceId = headers['x-trace-id'] as string | undefined;
    const userAgent = headers['user-agent'];

    const user = (request as RequestWithUser).user;
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
      userAgent: userAgent,
    };

    return next.handle().pipe(
      tap(() => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const statusCode = response.statusCode;

        this.logger.logRequest(method, url, statusCode, duration, {
          ...metadata,
          statusCode,
          duration,
          success: statusCode < 400,
        });

        if (duration > 1000) {
          this.logger.performance(`${method} ${url}`, duration, startTime, endTime, {
            ...metadata,
            type: 'slow_request',
            threshold: 1000,
          });
        }
      }),
      catchError((error: Error) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const statusCode = (error as { statusCode?: number }).statusCode ?? 500;

        this.logger.errorWithException(`Request failed: ${method} ${url}`, error, undefined, {
          ...metadata,
          duration,
          statusCode: statusCode ?? 500,
        });

        return throwError(() => error);
      }),
    );
  }
}
