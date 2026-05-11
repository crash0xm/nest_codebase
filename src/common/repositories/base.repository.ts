import { FindOptions } from '@/common/types/query.types';
import { PaginatedResult } from '@/common/types/pagination.types';

export abstract class BaseRepository<T, TEntity = T, TId = string> {
  abstract findById(id: TId, options?: FindOptions): Promise<TEntity | null>;
  abstract findOne(options: FindOptions): Promise<TEntity | null>;
  abstract findMany(options?: FindOptions): Promise<TEntity[]>;
  abstract findManyWithPagination(options?: FindOptions): Promise<PaginatedResult<TEntity>>;
  abstract create(data: Partial<T>): Promise<TEntity>;
  abstract update(id: TId, data: Partial<T>): Promise<TEntity>;
  abstract delete(id: TId): Promise<void>;
  abstract count(options?: FindOptions): Promise<number>;
  abstract exists(options?: FindOptions): Promise<boolean>;
}
