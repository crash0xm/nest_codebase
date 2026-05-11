import { PrismaService } from '@/modules/prisma/prisma.service';
import { AppLoggerService, LogContext } from '@/common/services/logger.service';
import { ApplicationError } from '@/common/domain/errors/application.error';
import { DatabaseError } from '@/common/errors/infrastructure.error';
import { BaseRepository } from './base.repository';
import { FindOptions, QueryFilter, QuerySort, QueryRelation } from '@/common/types/query.types';
import { PaginatedResult, buildPaginationMeta } from '@/common/types/pagination.types';

type PrismaDelegate = {
  findUnique(args: Record<string, unknown>): Promise<unknown>;
  findMany(args?: Record<string, unknown>): Promise<unknown[]>;
  count(args?: Record<string, unknown>): Promise<number>;
  create(args: Record<string, unknown>): Promise<unknown>;
  update(args: Record<string, unknown>): Promise<unknown>;
  delete(args: Record<string, unknown>): Promise<void>;
  findFirst(args?: Record<string, unknown>): Promise<unknown>;
};

type CompareOperator = 'gt' | 'gte' | 'lt' | 'lte';

const COMPARE_OPS: Record<CompareOperator, string> = {
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
};

export abstract class PrismaBaseRepository<T, TEntity = T> extends BaseRepository<T, TEntity> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly logger: AppLoggerService,
    protected readonly modelName: string,
  ) {
    super();
  }

  protected abstract getModelDelegate(): PrismaDelegate;

  // ── Translation layer: FindOptions → Prisma args ─────────────────────

  private buildPrismaWhere(filters?: QueryFilter[]): Record<string, unknown> | undefined {
    if (!filters?.length) return undefined;

    const where: Record<string, unknown> = {};
    for (const f of filters) {
      switch (f.operator) {
        case 'eq':
          where[f.field] = f.value;
          break;
        case 'ne':
          where[f.field] = { not: f.value };
          break;
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte':
          where[f.field] = { [COMPARE_OPS[f.operator]]: f.value };
          break;
        case 'like':
          where[f.field] = { contains: String(f.value).replace(/%/g, '') };
          break;
        case 'ilike':
          where[f.field] = {
            contains: String(f.value).replace(/%/g, ''),
            mode: 'insensitive',
          };
          break;
        case 'in':
          where[f.field] = { in: f.value as unknown[] };
          break;
        case 'nin':
          where[f.field] = { notIn: f.value as unknown[] };
          break;
        case 'isNull':
          where[f.field] = null;
          break;
        case 'isNotNull':
          where[f.field] = { not: null };
          break;
        case 'between': {
          const arr = f.value as [unknown, unknown];
          where[f.field] = { gte: arr[0], lte: arr[1] };
          break;
        }
      }
    }
    return where;
  }

  private buildPrismaSort(sort?: QuerySort[]): Record<string, 'asc' | 'desc'> | undefined {
    if (!sort?.length) return undefined;
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    for (const s of sort) orderBy[s.field] = s.order;
    return orderBy;
  }

  private buildPrismaInclude(relations?: QueryRelation[]): Record<string, unknown> | undefined {
    if (!relations?.length) return undefined;
    const include: Record<string, unknown> = {};
    for (const rel of relations) {
      include[rel.field] = rel.select
        ? { select: Object.fromEntries(rel.select.map((s) => [s, true])) }
        : true;
    }
    return include;
  }

  private buildPrismaSelect(select?: string[]): Record<string, true> | undefined {
    if (!select?.length) return undefined;
    return Object.fromEntries(select.map((s) => [s, true]));
  }

  protected toPrismaArgs(options?: FindOptions): Record<string, unknown> {
    if (!options) return {};
    const args: Record<string, unknown> = {};

    const where = this.buildPrismaWhere(options.filters);
    if (where) args.where = where;

    const orderBy = this.buildPrismaSort(options.sort);
    if (orderBy) args.orderBy = orderBy;

    const include = this.buildPrismaInclude(options.relations);
    if (include) args.include = include;

    const select = this.buildPrismaSelect(options.select);
    if (select) args.select = select;

    if (options.page != null && options.limit != null) {
      args.skip = (options.page - 1) * options.limit;
      args.take = options.limit;
    }

    return args;
  }

  // ── Execute with logging ────────────────────────────────────────────

  protected async executeWithLogging<R>(
    operation: string,
    callback: () => Promise<R>,
    metadata?: Record<string, unknown>,
  ): Promise<R> {
    const timer = this.logger.startTimer(`${this.modelName}.${operation}`, metadata);

    try {
      const result = await callback();
      timer();
      this.logger.database(`${this.modelName} ${operation} completed`, {
        operation: `${this.modelName}.${operation}`,
        success: true,
        ...metadata,
      });
      return result;
    } catch (error) {
      timer();
      this.logger.errorWithException(
        `${this.modelName} ${operation} failed`,
        error as Error,
        LogContext.DATABASE,
        {
          operation: `${this.modelName}.${operation}`,
          success: false,
          ...metadata,
        },
      );
      return this.handleExecuteError(operation, error, metadata);
    }
  }

  protected handleExecuteError(
    operation: string,
    error: unknown,
    metadata?: Record<string, unknown>,
  ): never {
    this.logger.errorWithException(
      `${this.modelName} ${operation} failed`,
      error as Error,
      LogContext.DATABASE,
      {
        operation: `${this.modelName}.${operation}`,
        success: false,
        ...metadata,
      },
    );

    if (error instanceof ApplicationError || error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(`${operation} failed for ${this.modelName}`, error);
  }

  // ── Standard CRUD ───────────────────────────────────────────────────

  async findById(id: string, options?: FindOptions): Promise<TEntity | null> {
    return this.executeWithLogging(
      'findById',
      async () => {
        const model = this.getModelDelegate();
        const prismaArgs = this.toPrismaArgs(options);
        return model.findUnique({ where: { id }, ...prismaArgs }) as Promise<TEntity | null>;
      },
      { id },
    );
  }

  async findOne(options: FindOptions): Promise<TEntity | null> {
    return this.executeWithLogging(
      'findOne',
      async () => {
        const model = this.getModelDelegate();
        const prismaArgs = this.toPrismaArgs(options);
        return model.findFirst(prismaArgs) as Promise<TEntity | null>;
      },
      { options },
    );
  }

  async findMany(options?: FindOptions): Promise<TEntity[]> {
    return this.executeWithLogging(
      'findMany',
      async () => {
        const model = this.getModelDelegate();
        const prismaArgs = this.toPrismaArgs(options);
        return model.findMany(prismaArgs) as Promise<TEntity[]>;
      },
      { options },
    );
  }

  async findManyWithPagination(options?: FindOptions): Promise<PaginatedResult<TEntity>> {
    return this.executeWithLogging(
      'findManyWithPagination',
      async () => {
        const model = this.getModelDelegate();
        const page = options?.page ?? 1;
        const limit = options?.limit ?? 10;
        const filters = options?.filters;

        const where = this.buildPrismaWhere(filters);

        const total = await model.count({ where });

        const prismaArgs = this.toPrismaArgs(options);
        const data = await model.findMany({
          ...prismaArgs,
          skip: (page - 1) * limit,
          take: limit,
        });

        return {
          data: data as TEntity[],
          total,
          ...buildPaginationMeta(total, page, limit),
        };
      },
      { options },
    );
  }

  async create(data: Partial<T>): Promise<TEntity> {
    return this.executeWithLogging(
      'create',
      async () => {
        const model = this.getModelDelegate();
        return model.create({ data }) as Promise<TEntity>;
      },
      { data },
    );
  }

  async update(id: string, data: Partial<T>): Promise<TEntity> {
    return this.executeWithLogging(
      'update',
      async () => {
        const model = this.getModelDelegate();
        return model.update({ where: { id }, data }) as Promise<TEntity>;
      },
      { id, data },
    );
  }

  async delete(id: string): Promise<void> {
    return this.executeWithLogging(
      'delete',
      async () => {
        const model = this.getModelDelegate();
        await model.delete({ where: { id } });
      },
      { id },
    );
  }

  async count(options?: FindOptions): Promise<number> {
    return this.executeWithLogging(
      'count',
      async () => {
        const model = this.getModelDelegate();
        const where = this.buildPrismaWhere(options?.filters);
        return model.count({ where });
      },
      { options },
    );
  }

  async exists(options?: FindOptions): Promise<boolean> {
    return this.executeWithLogging(
      'exists',
      async () => {
        const model = this.getModelDelegate();
        const where = this.buildPrismaWhere(options?.filters);
        const result = await model.count({ where });
        return result > 0;
      },
      { options },
    );
  }

  // ── Transaction ─────────────────────────────────────────────────────

  protected async runInTransaction<R>(
    callback: (tx: unknown) => Promise<R>,
    metadata?: Record<string, unknown>,
  ): Promise<R> {
    return this.executeWithLogging(
      'transaction',
      async () => {
        const prismaTx = this.prisma as unknown as {
          $transaction: <R>(fn: (tx: unknown) => Promise<R>) => Promise<R>;
        };
        return prismaTx.$transaction(callback);
      },
      metadata,
    );
  }

  // ── Health ──────────────────────────────────────────────────────────

  protected async healthCheck(): Promise<{
    connected: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const prismaRaw = this.prisma as unknown as {
        $queryRaw: (strings: TemplateStringsArray) => Promise<unknown>;
      };
      await prismaRaw.$queryRaw`SELECT 1`;
      return { connected: true, responseTime: Date.now() - startTime };
    } catch (error) {
      return {
        connected: false,
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }
}
