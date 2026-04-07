import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AppError } from '@/common/errors/app.error';
import { ApplicationError } from '@/common/domain/errors/application.error';
import {
  createErrorResponse,
  createValidationErrorResponse,
} from '@/common/interfaces/error-response.interface';

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
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.getErrorResponse(exception, request);

    // Log the error with correlation
    this.logError(exception, request, errorResponse);

    response.status(errorResponse.meta.statusCode).json(errorResponse);
  }

  private getErrorResponse(exception: unknown, request: Request) {
    const requestId = request.headers['x-request-id'] as string | undefined;
    const traceId = request.headers['x-trace-id'] as string | undefined;

    // Priority: ApplicationError > AppError > HttpException > Unknown
    if (exception instanceof ApplicationError) {
      return {
        success: false,
        error: {
          code: exception.code,
          type: 'APPLICATION',
          message: exception.message,
          context: exception.context,
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

    // Handle AppError instances
    if (exception instanceof AppError) {
      const metadata = exception.getMetadata();

      // Add request context
      metadata.requestId = requestId;
      metadata.traceId = traceId;
      metadata.path = request.url;
      metadata.method = request.method;

      // Handle validation errors specially
      if (exception.errorType === 'VALIDATION' && exception.details) {
        return createValidationErrorResponse(
          metadata,
          exception.details as Array<{
            field: string;
            message: string;
            value?: any;
          }>,
        );
      }

      return createErrorResponse(metadata);
    }

    // Handle HttpException (including ValidationPipe errors)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      // Handle ValidationPipe errors
      if (this.isValidationError(response)) {
        const validationErrors = this.extractValidationErrors(response);

        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            type: 'VALIDATION',
            message: 'Validation failed',
            details: validationErrors,
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
          type: this.getErrorTypeFromStatus(status),
          message,
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

    // Handle unexpected errors
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
      const message = response.message;

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

  private getErrorTypeFromStatus(status: number): string {
    if (status >= 400 && status < 500) {
      return 'CLIENT_ERROR';
    }

    if (status >= 500) {
      return 'SERVER_ERROR';
    }

    return 'UNKNOWN';
  }

  private createUnknownErrorResponse(exception: unknown, request: Request) {
    const requestId = request.headers['x-request-id'] as string | undefined;
    const traceId = request.headers['x-trace-id'] as string | undefined;
    const isProduction = this.configService.get('app.nodeEnv') === 'production';

    const baseResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        type: 'INTERNAL_SERVER',
        message: isProduction
          ? 'Internal server error'
          : exception instanceof Error
            ? exception.message
            : 'Unknown error',
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

  private logError(
    exception: unknown,
    request: Request,
    errorResponse: any,
  ): void {
    const isProduction = this.configService.get('app.nodeEnv') === 'production';
    const requestId = errorResponse.meta.requestId;
    const traceId = errorResponse.meta.traceId;

    const logContext = {
      requestId,
      traceId,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      statusCode: errorResponse.meta.statusCode,
      errorType: errorResponse.error.type,
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
}
