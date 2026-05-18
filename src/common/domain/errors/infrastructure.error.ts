export class InfrastructureError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = 'InfrastructureError';
    this.code = code;
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseError extends InfrastructureError {
  constructor(operation: string, cause?: unknown) {
    super(`Database operation failed: ${operation}`, 'DATABASE_ERROR', cause);
  }
}

export class CacheError extends InfrastructureError {
  constructor(operation: string, cause?: unknown) {
    super(`Cache operation failed: ${operation}`, 'CACHE_ERROR', cause);
  }
}
