import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { ApplicationError } from '@/common/domain/errors/application.error';
import { DomainError } from '@/common/domain/errors/domain.error';
import { InfrastructureError } from '@/common/errors/infrastructure.error';

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

  private getErrorResponse(exception: unknown, request: FastifyRequest) {
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
      const response = exception.getResponse();

      if (this.isValidationError(response)) {
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

      // Handle other HTTP exceptions
      const message = this.extractErrorMessage(response);

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

  private isValidationError(response: any): boolean {
    return (
      response &&
      typeof response === 'object' &&
      'message' in response &&
      Array.isArray(response.message)
    );
  }

  private extractValidationErrors(
    response: any,
  ): Array<{ field: string; message: string; value?: any }> {
    if (!response.message || !Array.isArray(response.message)) {
      return [];
    }

    return response.message.map((error: any) => {
      if (typeof error === 'string') {
        return { message: error };
      }

      if (typeof error === 'object' && error !== null) {
        return {
          field: error.property,
          message: Object.values(error.constraints || {}).join(', '),
          value: error.value,
        };
      }

      return { message: String(error) };
    });
  }

  private extractErrorMessage(response: any): string {
    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object' && response !== null) {
      const { message } = response;

      if (Array.isArray(message)) {
        return message.join(', ');
      }

      if (typeof message === 'string') {
        return message;
      }

      // Extract first message from nested object
      if (typeof message === 'object') {
        const firstKey = Object.keys(message)[0];
        const firstMessage = message[firstKey];
        if (Array.isArray(firstMessage)) {
          return firstMessage.join(', ');
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

    return statusCodes[status] || 'UNKNOWN_ERROR';
  }

  private createUnknownErrorResponse(exception: unknown, request: FastifyRequest) {
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
              message: exception.stack || 'No stack trace available',
            },
          ],
        },
      };
    }

    return baseResponse;
  }

  private logError(exception: unknown, request: FastifyRequest, errorResponse: any): void {
    const isProduction = this.configService.get('app.nodeEnv') === 'production';
    const { requestId } = errorResponse.meta;
    const { traceId } = errorResponse.meta;

    const logContext = {
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

  private extractErrorLocation(
    exception: unknown,
  ): { function?: string; file?: string; line?: number; column?: number } | undefined {
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
