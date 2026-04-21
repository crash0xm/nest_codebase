import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { ValidationError } from 'class-validator';
import { ApplicationError } from '@/common/domain/errors/application.error';
import { DomainError } from '@/common/domain/errors/domain.error';
import { InfrastructureError } from '@/common/errors/infrastructure.error';

type ErrorLocation = { function?: string; file?: string; line?: number; column?: number };

interface StandardErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string; value?: unknown }>;
    context?: Record<string, unknown>;
    location?: ErrorLocation;
  };
  meta: {
    timestamp: string;
    requestId: string | undefined;
    traceId: string | undefined;
    path: string;
    method: string;
    statusCode: number;
  };
}

/**
 * 🔍 Global Exception Filter
 *
 * Centralized error handling with:
 * - Structured error responses
 * - Request ID correlation
 * - Production safety (no stack traces in prod)
 * - Security error redaction
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>(); // FastifyReply
    const request = ctx.getRequest<FastifyRequest>(); // FastifyRequest

    const errorResponse = this.getErrorResponse(exception, request);

    // Log the error with correlation
    this.logError(exception, request, errorResponse);

    // Fastify uses .code() instead of .status()
    response.code(errorResponse.meta.statusCode).send(errorResponse);
  }

  private getErrorResponse(exception: unknown, request: FastifyRequest): StandardErrorResponse {
    const requestId = request.headers['x-request-id'] as string | undefined;
    const traceId = request.headers['x-trace-id'] as string | undefined;
    const errorLocation = this.shouldIncludeErrorLocation()
      ? this.extractErrorLocation(exception)
      : undefined;

    if (exception instanceof ApplicationError) {
      return {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.context ? { context: exception.context } : {}),
          ...(errorLocation ? { location: errorLocation } : {}),
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          traceId,
          path: request.url,
          method: request.method,
          statusCode: exception.statusCode,
        },
      };
    }

    if (exception instanceof DomainError) {
      return {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.context ? { context: exception.context } : {}),
          ...(errorLocation ? { location: errorLocation } : {}),
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          traceId,
          path: request.url,
          method: request.method,
          statusCode: 422,
        },
      };
    }

    if (exception instanceof InfrastructureError) {
      return {
        success: false,
        error: {
          code: exception.code,
          message: 'Service temporarily unavailable',
          ...(errorLocation ? { location: errorLocation } : {}),
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          traceId,
          path: request.url,
          method: request.method,
          statusCode: 503,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse() as string | Record<string, unknown>;

      if (this.isValidationErrorResponse(response)) {
        const validationErrors = this.extractValidationErrors(response);

        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Validation failed',
            details: validationErrors,
            ...(errorLocation ? { location: errorLocation } : {}),
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
            traceId,
            path: request.url,
            method: request.method,
            statusCode: status,
          },
        };
      }

      const message = typeof response === 'string' ? response : this.extractErrorMessage(response);

      return {
        success: false,
        error: {
          code: this.getErrorCodeFromStatus(status),
          message,
          ...(errorLocation ? { location: errorLocation } : {}),
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          traceId,
          path: request.url,
          method: request.method,
          statusCode: status,
        },
      };
    }

    return this.createUnknownErrorResponse(exception, request);
  }

  private isValidationErrorResponse(
    response: unknown,
  ): response is { message: string[] | ValidationError[] } {
    return (
      typeof response === 'object' &&
      response !== null &&
      'message' in response &&
      Array.isArray((response as { message: unknown }).message)
    );
  }

  private extractValidationErrors(response: {
    message: string[] | ValidationError[];
  }): Array<{ field: string; message: string; value?: unknown }> {
    const { message } = response;
    if (!Array.isArray(message)) {
      return [];
    }

    return message.map((error: string | ValidationError) => {
      if (typeof error === 'string') {
        return { field: '', message: error };
      }

      const ve = error;
      const constraints = ve.constraints as Record<string, string> | undefined;
      const msg =
        constraints !== undefined ? Object.values(constraints).join(', ') : 'Validation error';
      return {
        field: ve.property,
        message: msg,
        value: ve.value as unknown,
      };
    });
  }

  private extractErrorMessage(response: string | Record<string, unknown>): string {
    if (typeof response === 'string') {
      return response;
    }

    const raw = response.message;
    if (Array.isArray(raw)) {
      return raw
        .map((item) =>
          typeof item === 'string'
            ? item
            : typeof item === 'object' && item !== null
              ? 'Invalid'
              : '',
        )
        .filter(Boolean)
        .join(', ');
    }

    if (typeof raw === 'string') {
      return raw;
    }

    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      const nested = raw as Record<string, unknown>;
      const firstKey = Object.keys(nested)[0];
      if (firstKey !== undefined) {
        const firstMessage = nested[firstKey];
        if (Array.isArray(firstMessage)) {
          return firstMessage.filter((x): x is string => typeof x === 'string').join(', ');
        }
        if (typeof firstMessage === 'string') {
          return firstMessage;
        }
      }
    }

    return 'Internal server error';
  }

  private getErrorCodeFromStatus(status: number): string {
    const statusCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };

    return statusCodes[status] ?? 'UNKNOWN_ERROR';
  }

  private createUnknownErrorResponse(
    exception: unknown,
    request: FastifyRequest,
  ): StandardErrorResponse {
    const requestId = request.headers['x-request-id'] as string | undefined;
    const traceId = request.headers['x-trace-id'] as string | undefined;
    const isProduction = this.configService.get('app.nodeEnv') === 'production';
    const errorLocation = this.shouldIncludeErrorLocation()
      ? this.extractErrorLocation(exception)
      : undefined;

    const baseResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: isProduction
          ? 'Internal server error'
          : exception instanceof Error
            ? exception.message
            : 'Unknown error',
        ...(errorLocation ? { location: errorLocation } : {}),
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        traceId,
        path: request.url,
        method: request.method,
        statusCode: 500,
      },
    };

    // Add stack trace in development
    if (!isProduction && exception instanceof Error) {
      return {
        ...baseResponse,
        error: {
          ...baseResponse.error,
          details: [
            {
              field: 'stack',
              message: exception.stack ?? 'No stack trace available',
            },
          ],
        },
      };
    }

    return baseResponse;
  }

  private logError(
    exception: unknown,
    request: FastifyRequest,
    errorResponse: StandardErrorResponse,
  ): void {
    const isProduction = this.configService.get('app.nodeEnv') === 'production';
    const { requestId } = errorResponse.meta;
    const { traceId } = errorResponse.meta;

    const logContext: Record<string, unknown> = {
      requestId,
      traceId,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      statusCode: errorResponse.meta.statusCode,
      errorCode: errorResponse.error.code,
    };

    if (exception instanceof HttpException) {
      // Log HTTP exceptions with appropriate level
      const status = exception.getStatus();
      if (status >= 500) {
        this.logger.error('HTTP Server Error', logContext);
      } else if (status >= 400) {
        this.logger.warn('HTTP Client Error', logContext);
      }
    } else {
      // Log unexpected errors
      this.logger.error(
        'Unexpected Error',
        isProduction ? logContext : { ...logContext, exception },
      );
    }
  }

  private shouldIncludeErrorLocation(): boolean {
    return this.configService.get('app.nodeEnv') !== 'production';
  }

  private extractErrorLocation(exception: unknown): ErrorLocation | undefined {
    if (!(exception instanceof Error) || !exception.stack) {
      return undefined;
    }

    const stackLines = exception.stack.split('\n').map((line) => line.trim());
    const relevantStackLine = stackLines.find(
      (line) => line.startsWith('at ') && !line.includes('global-exception.filter'),
    );

    if (!relevantStackLine) {
      return undefined;
    }

    const withFunctionMatch = relevantStackLine.match(/^at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/);
    if (withFunctionMatch) {
      return {
        function: withFunctionMatch[1],
        file: withFunctionMatch[2],
        line: Number(withFunctionMatch[3]),
        column: Number(withFunctionMatch[4]),
      };
    }

    const noFunctionMatch = relevantStackLine.match(/^at\s+(.+):(\d+):(\d+)$/);
    if (noFunctionMatch) {
      return {
        file: noFunctionMatch[1],
        line: Number(noFunctionMatch[2]),
        column: Number(noFunctionMatch[3]),
      };
    }

    return undefined;
  }
}
