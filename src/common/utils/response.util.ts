import type { FastifyRequest } from 'fastify';
import type { BaseResponse } from '@/common/interfaces/base-response.interface';

export function ok<T>(data: T, message?: string, request?: FastifyRequest): BaseResponse<T> {
  return {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: request?.headers['x-request-id'] as string | undefined,
      traceId: request?.headers['x-trace-id'] as string | undefined,
    },
  };
}

export function paginated<T>(
  result: { data: T[]; total: number; page: number; limit: number },
  request?: FastifyRequest,
): BaseResponse<{ items: T[]; total: number; page: number; limit: number; totalPages: number }> {
  const totalPages = Math.ceil(result.total / result.limit);
  return {
    success: true,
    data: {
      items: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: request?.headers['x-request-id'] as string | undefined,
      traceId: request?.headers['x-trace-id'] as string | undefined,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages,
      },
    },
  };
}
