import { Prisma } from '@/generated/prisma/client';
import {
  ApplicationError,
  ConflictError,
  NotFoundError,
} from '@/common/domain/errors/application.error';
import { DatabaseError } from '@/common/errors/infrastructure.error';

export class PrismaErrorMapper {
  static toApplicationError(error: unknown, context: { entity: string; id?: string }): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = error;
      const errorCode: string = prismaError.code;
      const errorMeta: Record<string, unknown> =
        (prismaError.meta as Record<string, unknown>) ?? {};

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
          throw new DatabaseError(`error [${errorCode}] for ${context.entity}`, error);
      }
    }
    throw new DatabaseError(`Unexpected error for ${context.entity}`, error);
  }
}
