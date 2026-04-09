import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorType, ErrorCode, ErrorContext, ErrorMetadata, ErrorDetail } from './error.types';

/* eslint-disable max-params */
export class AppError extends HttpException {
  public readonly errorType: ErrorType;
  public readonly errorCode: ErrorCode;
  public readonly context?: ErrorContext;
  public readonly details?: ErrorDetail[];
  public readonly timestamp: string;
  public readonly requestId?: string;
  public readonly traceId?: string;

  constructor(
    message: string,
    statusCode: HttpStatus,
    errorType: ErrorType,
    errorCode: ErrorCode,
    options?: {
      context?: ErrorContext;
      details?: ErrorDetail[];
      requestId?: string;
      traceId?: string;
      cause?: Error;
    },
  ) {
    super(message, statusCode);

    this.errorType = errorType;
    this.errorCode = errorCode;
    this.context = options?.context;
    this.details = options?.details;
    this.requestId = options?.requestId;
    this.traceId = options?.traceId;
    this.timestamp = new Date().toISOString();

    if (options?.cause) {
      this.cause = options.cause;
    }
  }

  public getMetadata(): ErrorMetadata {
    return {
      timestamp: this.timestamp,
      requestId: this.requestId,
      traceId: this.traceId,
      statusCode: this.getStatus(),
      errorType: this.errorType,
      errorCode: this.errorCode,
      context: this.context,
      details: this.details,
      stack: this.stack,
    };
  }

  public toJSON(): ErrorMetadata {
    return this.getMetadata();
  }

  // Static factory methods for common error types
  static validationFailed(
    message: string = 'Validation failed',
    details?: ErrorDetail[],
    context?: ErrorContext,
  ): AppError {
    return new AppError(
      message,
      HttpStatus.BAD_REQUEST,
      ErrorType.VALIDATION,
      ErrorCode.VALIDATION_FAILED,
      { context, details },
    );
  }

  static invalidInput(
    message: string = 'Invalid input provided',
    field?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value?: any,
    context?: ErrorContext,
  ): AppError {
    const details = field != null ? [{ field, message, value }] : undefined;
    return new AppError(
      message,
      HttpStatus.BAD_REQUEST,
      ErrorType.VALIDATION,
      ErrorCode.INVALID_INPUT,
      { context, details },
    );
  }

  static unauthorized(message: string = 'Unauthorized access', context?: ErrorContext): AppError {
    return new AppError(
      message,
      HttpStatus.UNAUTHORIZED,
      ErrorType.AUTHENTICATION,
      ErrorCode.INVALID_CREDENTIALS,
      { context },
    );
  }

  static forbidden(message: string = 'Access forbidden', context?: ErrorContext): AppError {
    return new AppError(
      message,
      HttpStatus.FORBIDDEN,
      ErrorType.AUTHORIZATION,
      ErrorCode.INSUFFICIENT_PERMISSIONS,
      { context },
    );
  }

  static notFound(resource: string, identifier?: string, context?: ErrorContext): AppError {
    const message =
      identifier != null
        ? `${resource} with identifier '${identifier}' not found`
        : `${resource} not found`;

    return new AppError(
      message,
      HttpStatus.NOT_FOUND,
      ErrorType.NOT_FOUND,
      ErrorCode.RESOURCE_NOT_FOUND,
      {
        context: {
          ...context,
          resource,
          identifier,
        },
      },
    );
  }

  static conflict(
    message: string = 'Resource conflict',
    details?: ErrorDetail[],
    context?: ErrorContext,
  ): AppError {
    return new AppError(
      message,
      HttpStatus.CONFLICT,
      ErrorType.CONFLICT,
      ErrorCode.RESOURCE_CONFLICT,
      { context, details },
    );
  }

  static badRequest(
    message: string = 'Bad request',
    details?: ErrorDetail[],
    context?: ErrorContext,
  ): AppError {
    return new AppError(
      message,
      HttpStatus.BAD_REQUEST,
      ErrorType.VALIDATION,
      ErrorCode.INVALID_INPUT,
      { context, details },
    );
  }

  static duplicateResource(
    resource: string,
    field: string,

    value: unknown,
    context?: ErrorContext,
  ): AppError {
    const message = `${resource} with ${field} '${value}' already exists`;

    return new AppError(
      message,
      HttpStatus.CONFLICT,
      ErrorType.CONFLICT,
      ErrorCode.DUPLICATE_RESOURCE,
      {
        context: {
          ...context,
          resource,
          field,
          value,
        },
        details: [{ field, message, value }],
      },
    );
  }

  static internalError(
    message: string = 'Internal server error',
    cause?: Error,
    context?: ErrorContext,
  ): AppError {
    return new AppError(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorType.INTERNAL_SERVER,
      ErrorCode.INTERNAL_ERROR,
      { context, cause },
    );
  }

  static serviceUnavailable(service: string, context?: ErrorContext): AppError {
    const message = `${service} service is currently unavailable`;

    return new AppError(
      message,
      HttpStatus.SERVICE_UNAVAILABLE,
      ErrorType.SERVICE_UNAVAILABLE,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      {
        context: {
          ...context,
          service,
        },
      },
    );
  }

  static rateLimitExceeded(limit?: number, windowMs?: number, context?: ErrorContext): AppError {
    const message =
      limit != null
        ? `Rate limit exceeded. Maximum ${limit} requests per ${windowMs}ms allowed`
        : 'Rate limit exceeded';

    return new AppError(
      message,
      HttpStatus.TOO_MANY_REQUESTS,
      ErrorType.RATE_LIMIT,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      {
        context: {
          ...context,
          limit,
          windowMs,
        },
      },
    );
  }

  static databaseError(
    message: string = 'Database operation failed',
    cause?: Error,
    context?: ErrorContext,
  ): AppError {
    return new AppError(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorType.DATABASE,
      ErrorCode.DATABASE_CONNECTION_FAILED,
      { context, cause },
    );
  }

  static timeout(operation: string, timeoutMs: number, context?: ErrorContext): AppError {
    const message = `${operation} operation timed out after ${timeoutMs}ms`;

    return new AppError(message, HttpStatus.REQUEST_TIMEOUT, ErrorType.TIMEOUT, ErrorCode.TIMEOUT, {
      context: {
        ...context,
        operation,
        timeoutMs,
      },
    });
  }
}
