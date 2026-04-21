import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
}

export enum LogContext {
  HTTP = 'HTTP',
  DATABASE = 'DATABASE',
  AUTH = 'AUTH',
  BUSINESS = 'BUSINESS',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
  SYSTEM = 'SYSTEM',
  EXTERNAL = 'EXTERNAL',
}

export interface LogMetadata {
  requestId?: string;
  traceId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  context: LogContext;
  message: string;
  metadata?: LogMetadata;
  timestamp: string;
  duration?: number;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string;
  };
}

export interface PerformanceLogEntry extends LogEntry {
  context: LogContext.PERFORMANCE;
  operation: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AppLoggerService {
  private readonly isProduction: boolean;
  private readonly serviceName: string;
  private readonly version: string;
  private readonly nestLogger: Logger;

  constructor(private readonly configService: ConfigService) {
    this.nestLogger = new Logger('AppLogger');
    this.isProduction = this.configService.get('app.nodeEnv') === 'production';
    this.serviceName = this.configService.get('app.name', 'NestJS SaaS');
    this.version = this.configService.get('app.apiVersion', '1.0.0');
  }

  // Basic logging methods
  error(message: string, context?: LogContext, metadata?: LogMetadata): void {
    this.log(LogLevel.ERROR, message, context, metadata);
  }

  warn(message: string, context?: LogContext, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, context, metadata);
  }

  info(message: string, context?: LogContext, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, context, metadata);
  }

  debug(message: string, context?: LogContext, metadata?: LogMetadata): void {
    if (!this.isProduction) {
      this.log(LogLevel.DEBUG, message, context, metadata);
    }
  }

  trace(message: string, context?: LogContext, metadata?: LogMetadata): void {
    if (!this.isProduction) {
      this.log(LogLevel.TRACE, message, context, metadata);
    }
  }

  // Context-specific logging methods
  http(message: string, metadata?: LogMetadata): void {
    this.info(message, LogContext.HTTP, metadata);
  }

  database(message: string, metadata?: LogMetadata): void {
    this.info(message, LogContext.DATABASE, metadata);
  }

  auth(message: string, metadata?: LogMetadata): void {
    this.info(message, LogContext.AUTH, metadata);
  }

  business(message: string, metadata?: LogMetadata): void {
    this.info(message, LogContext.BUSINESS, metadata);
  }

  security(message: string, metadata?: LogMetadata): void {
    this.warn(message, LogContext.SECURITY, metadata);
  }

  system(message: string, metadata?: LogMetadata): void {
    this.info(message, LogContext.SYSTEM, metadata);
  }

  external(message: string, metadata?: LogMetadata): void {
    this.info(message, LogContext.EXTERNAL, metadata);
  }

  // Error logging with structured error information
  errorWithException(
    message: string,
    error: Error,
    context?: LogContext,
    metadata?: LogMetadata,
  ): void {
    this.log(LogLevel.ERROR, message, context, {
      ...metadata,
      error: {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack,
        code: (error as { code?: string }).code,
      },
    });
  }

  // Performance logging
  startTimer(operation: string, metadata?: LogMetadata): () => void {
    const startTime = Date.now();

    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.performance(operation, duration, startTime, endTime, metadata);
    };
  }

  performance(
    operation: string,
    duration: number,
    startTime: number,
    endTime: number,
    metadata?: LogMetadata,
  ): void {
    const logEntry: PerformanceLogEntry = {
      level: LogLevel.INFO,
      context: LogContext.PERFORMANCE,
      message: `Operation completed: ${operation}`,
      timestamp: new Date().toISOString(),
      operation,
      duration,
      startTime,
      endTime,
      metadata,
    };

    this.writeLog(logEntry);
  }

  // Request logging
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: LogMetadata,
  ): void {
    this.http(`${method} ${url} ${statusCode} - ${duration}ms`, {
      ...metadata,
      method,
      url,
      statusCode,
      duration,
    });
  }

  // Security event logging
  logSecurityEvent(
    event: string,
    details: Record<string, unknown>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    metadata?: LogMetadata,
  ): void {
    this.warn(`Security event: ${event}`, LogContext.SECURITY, {
      ...metadata,
      securityEvent: event,
      details,
      severity,
    });
  }

  // Database operation logging
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    metadata?: LogMetadata,
  ): void {
    this.database(`Database ${operation} on ${table} - ${duration}ms`, {
      ...metadata,
      operation,
      table,
      duration,
    });
  }

  // Business event logging
  logBusinessEvent(event: string, userId?: string, metadata?: LogMetadata): void {
    this.business(`Business event: ${event}`, {
      ...metadata,
      userId,
      businessEvent: event,
    });
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
  ): void {
    const logEntry: LogEntry = {
      level,
      context: context ?? LogContext.SYSTEM,
      message,
      timestamp: new Date().toISOString(),
      metadata: {
        service: this.serviceName,
        version: this.version,
        ...metadata,
      },
    };

    this.writeLog(logEntry);
  }

  private writeLog(logEntry: LogEntry): void {
    const logData = {
      level: logEntry.level,
      context: logEntry.context,
      message: logEntry.message,
      timestamp: logEntry.timestamp,
      ...logEntry.metadata,
    };

    // Use NestJS logger with appropriate level
    switch (logEntry.level) {
      case LogLevel.ERROR:
        this.nestLogger.error(logEntry.message, logEntry.context, logData);
        break;
      case LogLevel.WARN:
        this.nestLogger.warn(logEntry.message, logEntry.context, logData);
        break;
      case LogLevel.INFO:
        this.nestLogger.log(logEntry.message, logData);
        break;
      case LogLevel.DEBUG:
        this.nestLogger.debug?.(logEntry.message, logEntry.context, logData);
        break;
      case LogLevel.TRACE:
        this.nestLogger.verbose?.(logEntry.message, logEntry.context, logData);
        break;
    }
  }
}
