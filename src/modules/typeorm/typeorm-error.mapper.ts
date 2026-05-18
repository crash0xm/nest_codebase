import {
  ApplicationError,
  ConflictError,
  NotFoundError,
} from '@/common/domain/errors/application.error';
import { DatabaseError } from '@/common/domain/errors/infrastructure.error';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';

export class TypeOrmErrorMapper {
  static toApplicationError(error: unknown, context: { entity: string; id?: string }): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string; constraint?: string };
      const errorCode = driverError?.code;

      if (errorCode === '23505') {
        throw new ConflictError(`${context.entity} already exists`, {
          constraint: driverError?.constraint,
        });
      }

      if (errorCode === '23503') {
        throw new ApplicationError(
          `Invalid reference in ${context.entity}`,
          'INVALID_REFERENCE',
          400,
        );
      }

      throw new DatabaseError(`Query failed for ${context.entity}: ${errorCode}`, error);
    }

    if (error instanceof EntityNotFoundError) {
      throw new NotFoundError(context.entity, context.id ?? 'unknown');
    }

    if (error instanceof ApplicationError) {
      throw error;
    }

    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError(`Unexpected error for ${context.entity}`, error);
  }
}
