import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import { AppLoggerService } from '@/common/services/logger.service';

interface AuditRequest {
  user?: { id?: string | undefined };
  method: string;
  url: string;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService,
    private readonly logger: AppLoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuditRequest>();
    const { user, method, url } = req;
    const startTime = Date.now();
    const requestId = this.cls.get<string>('requestId') ?? 'anonymous';

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.business(`Audit: ${method} ${url} - Success`, {
            userId: user?.id ?? 'anonymous',
            action: `${method} ${url}`,
            duration: Date.now() - startTime,
            requestId,
            status: 'success',
          });
        },
        error: (err: Error) => {
          this.logger.warn(`Audit failure: ${method} ${url} - ${err.message}`, undefined, {
            userId: user?.id ?? 'anonymous',
            action: `${method} ${url}`,
            duration: Date.now() - startTime,
            error: err.message,
          });
        },
      }),
    );
  }
}
