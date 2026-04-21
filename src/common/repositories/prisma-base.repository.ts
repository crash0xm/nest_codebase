import { PrismaService } from '@/modules/prisma/prisma.service';
import { AppLoggerService, LogContext } from '@/common/services/logger.service';
import { ApplicationError } from '@/common/domain/errors/application.error';
import { DatabaseError } from '@/common/errors/infrastructure.error';
import { BaseRepository, QueryOptions } from './base.repository';
import {
  PaginationOptions,
  PaginatedResult,
  buildPaginationMeta,
} from '@/common/types/pagination.types';

export abstract class PrismaBaseRepository<T> extends BaseRepository<T> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly logger: AppLoggerService,
    protected readonly modelName: string,
  ) {
    super();
  }

  protected abstract getModelDelegate(): {
    findUnique(args: Record<string, unknown>): Promise<T | null>;
    findMany(args?: Record<string, unknown>): Promise<T[]>;
    count(args?: Record<string, unknown>): Promise<number>;
    create(args: Record<string, unknown>): Promise<T>;
    update(args: Record<string, unknown>): Promise<T>;
    delete(args: Record<string, unknown>): Promise<void>;
    findFirst(args?: Record<string, unknown>): Promise<T | null>;
  };

  protected async executeWithLogging<R>(
    operation: string,
    callback: () => Promise<R>,
    metadata?: Record<string, unknown>,
  ): Promise<R> {
    const timer = this.logger.startTimer(`${this.modelName}.${operation}`, metadata);

    try {
      const result = await callback();
      timer();
      this.logger.database(`${this.modelName} ${operation} completed successfully`, {
        ...metadata,
        operation: `${this.modelName}.${operation}`,
        success: true,
      });
      return result;
    } catch (error) {
      timer();
      this.logger.errorWithException(
        `${this.modelName} ${operation} failed`,
        error as Error,
        LogContext.DATABASE,
        {
          ...metadata,
          operation: `${this.modelName}.${operation}`,
          success: false,
        },
      );
      return this.handleExecuteError(operation, error, metadata);
    }
  }

  private handleExecuteError(
    operation: string,
    error: unknown,
    metadata?: Record<string, unknown>,
  ): never {
    this.logger.errorWithException(
      `${this.modelName} ${operation} failed`,
      error as Error,
      LogContext.DATABASE,
      {
        ...metadata,
        operation: `${this.modelName}.${operation}`,
        success: false,
      },
    );

    if (error instanceof ApplicationError || error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(`${operation} failed for ${this.modelName}`, error);
  }

  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    return this.executeWithLogging(
      'findById',
      async () => {
        const model = this.getModelDelegate();
        return model.findUnique({
          where: { id },
          ...options,
        });
      },
      { id },
    );
  }

  async findMany(where?: Record<string, unknown>, options?: QueryOptions): Promise<T[]> {
    return this.executeWithLogging(
      'findMany',
      async () => {
        const model = this.getModelDelegate();
        return model.findMany({
          where,
          ...options,
        });
      },
      { where },
    );
  }

  async findManyWithPagination(
    where?: Record<string, unknown>,
    pagination?: PaginationOptions,
    options?: QueryOptions,
  ): Promise<PaginatedResult<T>> {
    return this.executeWithLogging(
      'findManyWithPagination',
      async () => {
        const model = this.getModelDelegate();
        const page = pagination?.page ?? 1;
        const limit = pagination?.limit ?? 10;
        const skip = (page - 1) * limit;

        const total = await model.count({ where });

        const orderBy = this.buildPaginationOrderBy(
          pagination?.sortBy,
          pagination?.sortOrder,
          options?.orderBy,
        );

        const data = await model.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          ...options,
        });

        return {
          data,
          total,
          ...buildPaginationMeta(total, page, limit),
        };
      },
      { where, pagination },
    );
  }

  async create(data: Record<string, unknown>, options?: QueryOptions): Promise<T> {
    return this.executeWithLogging(
      'create',
      async () => {
        const model = this.getModelDelegate();
        return model.create({
          data,
          ...options,
        });
      },
      { data },
    );
  }

  async update(id: string, data: Record<string, unknown>, options?: QueryOptions): Promise<T> {
    return this.executeWithLogging(
      'update',
      async () => {
        const model = this.getModelDelegate();
        return model.update({
          where: { id },
          data,
          ...options,
        });
      },
      { id, data },
    );
  }

  private buildPaginationOrderBy(
    sortBy: string | undefined,
    sortOrder: string | undefined,
    defaultOrderBy: unknown,
  ): Record<string, unknown> {
    return sortBy != null
      ? { [sortBy]: sortOrder ?? 'asc' }
      : ((defaultOrderBy as Record<string, unknown>) ?? {});
  }

  async delete(id: string): Promise<void> {
    return this.executeWithLogging(
      'delete',
      async () => {
        const model = this.getModelDelegate();
        await model.delete({
          where: { id },
        });
      },
      { id },
    );
  }

  protected async findOne(
    where?: Record<string, unknown>,
    options?: QueryOptions,
  ): Promise<T | null> {
    return this.executeWithLogging(
      'findOne',
      async () => {
        const model = this.getModelDelegate();
        return model.findFirst({
          where,
          ...options,
        });
      },
      { where },
    );
  }

  protected async count(where?: Record<string, unknown>): Promise<number> {
    return this.executeWithLogging(
      'count',
      async () => {
        const model = this.getModelDelegate();
        return model.count({ where });
      },
      { where },
    );
  }

  protected async exists(where?: Record<string, unknown>): Promise<boolean> {
    return this.executeWithLogging(
      'exists',
      async () => {
        const model = this.getModelDelegate();
        const result = await model.count({ where });
        return result > 0;
      },
      { where },
    );
  }

  protected async runInTransaction<R>(
    callback: (tx: unknown) => Promise<R>,
    metadata?: Record<string, unknown>,
  ): Promise<R> {
    return this.executeWithLogging(
      'transaction',
      () =>
        this.prisma.$transaction(
          callback as (
            tx: import('@/generated/prisma/client').Prisma.TransactionClient,
          ) => Promise<R>,
        ),
      metadata,
    );
  }

  protected async healthCheck(): Promise<{
    connected: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        connected: true,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        connected: false,
        responseTime,
        error: (error as Error).message,
      };
    }
  }
}
