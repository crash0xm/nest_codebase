import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyRequest } from 'fastify';
import { BaseResponse, ResponseMeta } from '@/common/interfaces/base-response.interface';

@Injectable()
export class ResponseInterceptor<T = unknown> implements NestInterceptor<unknown, BaseResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<BaseResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();

    return next.handle().pipe(
      map((data): BaseResponse<T> => {
        if (data && typeof data === 'object' && 'success' in data) {
          return data as BaseResponse<T>;
        }

        return {
          success: true,
          data: data as T,
          message: this.extractMessage(data),
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.headers['x-request-id'] as string | undefined,
            traceId: request.headers['x-trace-id'] as string | undefined,
            pagination: this.extractPagination(data),
          },
        };
      }),
    );
  }

  private extractMessage(data: unknown): string | undefined {
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if ('message' in obj && typeof obj.message === 'string') return obj.message;
      if ('msg' in obj && typeof obj.msg === 'string') return obj.msg;
    }
    if (typeof data === 'string') return data;
    return undefined;
  }

  private extractPagination(data: unknown): ResponseMeta['pagination'] {
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (obj.pagination) return obj.pagination as ResponseMeta['pagination'];
      if (obj.meta && typeof obj.meta === 'object' && 'pagination' in obj.meta) {
        return (obj.meta as Record<string, unknown>).pagination as ResponseMeta['pagination'];
      }
      if (obj.page !== undefined || obj.limit !== undefined) {
        return {
          page: Number(obj.page),
          limit: Number(obj.limit),
          total: Number(obj.total),
          totalPages: Number(obj.totalPages),
        };
      }
    }
    return undefined;
  }
}
