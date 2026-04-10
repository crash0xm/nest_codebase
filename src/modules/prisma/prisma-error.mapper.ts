import { Prisma } from '@/generated/prisma/client';
import { AppError } from '@/common/errors/app.error';

export class PrismaErrorMapper {
  static toAppError(
    error: unknown,
    context: { entity: string; id?: string },
  ): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const errorCode = error.code;
      switch (errorCode) {
        case 'P2002':
          throw AppError.conflict(`${context.entity} already exists`, [
            { code: 'ALREADY_EXISTS', value: error.meta },
          ]);
        case 'P2025':
          throw AppError.notFound(
            `${context.entity}${
              context.id != null ? ` [${context.id}]` : ''
            } not found`,
          );
        case 'P2003':
          throw AppError.badRequest(`Invalid reference in ${context.entity}`);
        default:
          throw AppError.databaseError(
            `Database error [${errorCode}] for ${context.entity}`,
            error,
          );
      }
    }
    throw AppError.databaseError(
      `Unexpected error for ${context.entity}`,
      error as Error,
    );
  }
}
