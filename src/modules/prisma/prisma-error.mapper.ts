import { Prisma } from '@/generated/prisma/client';
import {
  ApplicationError,
  ConflictError,
  NotFoundError,
} from '@/common/domain/errors/application.error';
import { DatabaseError } from '@/common/errors/infrastructure.error';

export class PrismaErrorMapper {
  private static isPrismaKnownError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError;
  }

  static toApplicationError(error: unknown, context: { entity: string; id?: string }): never {
    if (this.isPrismaKnownError(error)) {
      const prismaError = error as { code: string; meta?: unknown };
      const errorCode = prismaError.code;
      const errorMeta = (prismaError.meta ?? {}) as Record<string, unknown>;

      switch (errorCode) {
        case 'P2002':
          throw new ConflictError(`${context.entity} already exists`, {
            meta: errorMeta,
          });
        case 'P2025':
          throw new NotFoundError(context.entity, context.id ?? 'unknown');
        case 'P2003':
          throw new ApplicationError(
            `Invalid reference in ${context.entity}`,
            'INVALID_REFERENCE',
            400,
          );
        default:
          throw new DatabaseError(
            errorCode
              ? `error [${errorCode}] for ${context.entity}`
              : `error for ${context.entity}`,
            error,
          );
      }
    }
    throw new DatabaseError(`Unexpected error for ${context.entity}`, error);
  }
}
