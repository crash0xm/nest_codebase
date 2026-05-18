import {
  Repository,
  ObjectLiteral,
  FindOptionsWhere,
  FindOptionsOrder,
  FindManyOptions,
  DeepPartial,
  MoreThan,
  MoreThanOrEqual,
  LessThan,
  LessThanOrEqual,
  In,
  Not,
  IsNull,
  ILike,
  Between,
  EntityManager,
  UpdateResult,
} from 'typeorm';
import { TypeOrmService } from '@/modules/typeorm/typeorm.service';
import { AppLoggerService, LogContext } from '@/common/services/logger.service';
import { DatabaseError } from '@/common/errors/infrastructure.error';
import { TypeOrmErrorMapper } from '@/modules/typeorm/typeorm-error.mapper';
import { BaseRepository } from './base.repository';
import { FindOptions, QueryFilter, QuerySort, QueryRelation } from '@/common/types/query.types';
import { PaginatedResult, buildPaginationMeta } from '@/common/types/pagination.types';

export abstract class TypeOrmBaseRepository<
  T extends ObjectLiteral,
  TEntity = T,
  TId = string,
> extends BaseRepository<T, TEntity, TId> {
  constructor(
    protected readonly typeOrmService: TypeOrmService,
    protected readonly logger: AppLoggerService,
    protected readonly entityName: string,
  ) {
    super();
  }

  protected abstract get entity(): new () => T;

  protected getRepository(): Repository<T> {
    return this.typeOrmService.getRepository(this.entity);
  }

  // ── Translation layer: FindOptions → TypeORM options ────────────────

  private buildTypeOrmWhere(filters?: QueryFilter[]): FindOptionsWhere<T> | undefined {
    if (!filters?.length) return undefined;

    const where: Record<string, unknown> = {};
    for (const f of filters) {
      switch (f.operator) {
        case 'eq':
          where[f.field] = f.value;
          break;
        case 'ne':
          where[f.field] = Not(f.value);
          break;
        case 'gt':
          where[f.field] = MoreThan(f.value);
          break;
        case 'gte':
          where[f.field] = MoreThanOrEqual(f.value);
          break;
        case 'lt':
          where[f.field] = LessThan(f.value);
          break;
        case 'lte':
          where[f.field] = LessThanOrEqual(f.value);
          break;
        case 'like':
          where[f.field] = ILike(String(f.value).replace(/%/g, ''));
          break;
        case 'ilike':
          where[f.field] = ILike(String(f.value).replace(/%/g, ''));
          break;
        case 'in':
          where[f.field] = In(f.value as unknown[]);
          break;
        case 'nin':
          where[f.field] = Not(In(f.value as unknown[]));
          break;
        case 'isNull':
          where[f.field] = IsNull();
          break;
        case 'isNotNull':
          where[f.field] = Not(IsNull());
          break;
        case 'between': {
          const arr = f.value as [unknown, unknown];
          where[f.field] = Between(arr[0], arr[1]);
          break;
        }
      }
    }
    return where as unknown as FindOptionsWhere<T>;
  }

  private buildTypeOrmOrder(sort?: QuerySort[]): FindOptionsOrder<T> | undefined {
    if (!sort?.length) return undefined;
    const order: Record<string, string> = {};
    for (const s of sort) order[s.field] = s.order;
    return order as unknown as FindOptionsOrder<T>;
  }

  private buildTypeOrmRelations(relations?: QueryRelation[]): Record<string, true> | undefined {
    if (!relations?.length) return undefined;
    const rels: Record<string, true> = {};
    for (const r of relations) rels[r.field] = true;
    return rels;
  }

  private toFindManyOptions(options?: FindOptions): FindManyOptions<T> {
    const opts: FindManyOptions<T> = {};

    const where = this.buildTypeOrmWhere(options?.filters);
    if (where) opts.where = where;

    const order = this.buildTypeOrmOrder(options?.sort);
    if (order) opts.order = order;

    const relations = this.buildTypeOrmRelations(options?.relations);
    if (relations) opts.relations = relations as unknown as FindManyOptions<T>['relations'];

    if (options?.select?.length) {
      opts.select = Object.fromEntries(
        options.select.map((s) => [s, true]),
      ) as unknown as FindManyOptions<T>['select'];
    }

    if (options?.page != null && options?.limit != null) {
      opts.skip = (options.page - 1) * options.limit;
      opts.take = options.limit;
    }

    return opts;
  }

  // ── Execute with logging ────────────────────────────────────────────

  protected async executeWithLogging<R>(
    operation: string,
    callback: () => Promise<R>,
    metadata?: Record<string, unknown>,
  ): Promise<R> {
    const timer = this.logger.startTimer(`${this.entityName}.${operation}`, metadata);

    try {
      const result = await callback();
      timer();
      return result;
    } catch (error) {
      timer();
      this.logger.errorWithException(
        `${this.entityName} ${operation} failed`,
        error as Error,
        LogContext.DATABASE,
        {
          operation: `${this.entityName}.${operation}`,
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
      `${this.entityName} ${operation} failed`,
      error as Error,
      LogContext.DATABASE,
      {
        operation: `${this.entityName}.${operation}`,
        success: false,
        ...metadata,
      },
    );

    TypeOrmErrorMapper.toApplicationError(error, { entity: this.entityName });
  }

  // ── Standard CRUD ───────────────────────────────────────────────────

  async findById(id: TId, options?: FindOptions): Promise<TEntity | null> {
    return this.executeWithLogging(
      'findById',
      async () => {
        const repo = this.getRepository();
        const relations = this.buildTypeOrmRelations(
          options?.relations,
        ) as unknown as FindManyOptions<T>['relations'];
        const select = options?.select?.length
          ? (Object.fromEntries(
              options.select.map((s) => [s, true]),
            ) as unknown as FindManyOptions<T>['select'])
          : undefined;

        const result = await repo.findOne({
          where: { id } as unknown as FindOptionsWhere<T>,
          relations,
          select,
        });
        return (result ?? null) as TEntity | null;
      },
      { id },
    );
  }

  async findOne(options: FindOptions): Promise<TEntity | null> {
    return this.executeWithLogging(
      'findOne',
      async () => {
        const repo = this.getRepository();
        const opts = this.toFindManyOptions(options);
        const result = await repo.findOne(opts);
        return (result ?? null) as TEntity | null;
      },
      { options },
    );
  }

  async findMany(options?: FindOptions): Promise<TEntity[]> {
    return this.executeWithLogging(
      'findMany',
      async () => {
        const repo = this.getRepository();
        const opts = this.toFindManyOptions(options);
        return repo.find(opts) as unknown as Promise<TEntity[]>;
      },
      { options },
    );
  }

  async findManyWithPagination(options?: FindOptions): Promise<PaginatedResult<TEntity>> {
    return this.executeWithLogging(
      'findManyWithPagination',
      async () => {
        const repo = this.getRepository();
        const page = options?.page ?? 1;
        const limit = options?.limit ?? 10;

        const where = this.buildTypeOrmWhere(options?.filters);
        const order = this.buildTypeOrmOrder(options?.sort);
        const relations = this.buildTypeOrmRelations(
          options?.relations,
        ) as unknown as FindManyOptions<T>['relations'];

        const [data, total] = await repo.findAndCount({
          where,
          order,
          relations,
          skip: (page - 1) * limit,
          take: limit,
        });

        return {
          data: data as unknown as TEntity[],
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
        const repo = this.getRepository();
        const entity = repo.create(data as DeepPartial<T>);
        return repo.save(entity) as unknown as Promise<TEntity>;
      },
      { data },
    );
  }

  async update(id: TId, data: Partial<T>): Promise<TEntity> {
    return this.executeWithLogging(
      'update',
      async () => {
        const repo = this.getRepository();
        const typedQb: import('typeorm').UpdateQueryBuilder<ObjectLiteral> = repo
          .createQueryBuilder()
          .update(this.entity as unknown as new () => ObjectLiteral)
          .set(data as DeepPartial<ObjectLiteral>)
          .where('id = :id', { id: id as unknown as string })
          .returning('*');
        const { raw }: UpdateResult = await typedQb.execute();
        if (!raw?.length) {
          throw new DatabaseError(`Update failed: ${this.entityName} ${String(id)} not found`);
        }
        return raw[0] as unknown as TEntity;
      },
      { id, data },
    );
  }

  async delete(id: TId): Promise<void> {
    return this.executeWithLogging(
      'delete',
      async () => {
        const repo = this.getRepository();
        await repo.delete(id as unknown as FindOptionsWhere<T>);
      },
      { id },
    );
  }

  async count(options?: FindOptions): Promise<number> {
    return this.executeWithLogging(
      'count',
      async () => {
        const repo = this.getRepository();
        const where = this.buildTypeOrmWhere(options?.filters);
        return repo.count({ where });
      },
      { options },
    );
  }

  async exists(options?: FindOptions): Promise<boolean> {
    return this.executeWithLogging(
      'exists',
      async () => {
        const repo = this.getRepository();
        const where = this.buildTypeOrmWhere(options?.filters);
        const count = await repo.count({ where });
        return count > 0;
      },
      { options },
    );
  }

  // ── Transaction ─────────────────────────────────────────────────────

  protected async runInTransaction<R>(
    callback: (manager: EntityManager) => Promise<R>,
    metadata?: Record<string, unknown>,
  ): Promise<R> {
    return this.executeWithLogging(
      'transaction',
      async () => this.typeOrmService.dataSource.transaction(callback),
      metadata,
    );
  }
}
