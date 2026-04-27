import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';
import { DatabaseError } from '@/common/errors/infrastructure.error';

export type PrismaTransactionClient = Prisma.TransactionClient;
export type TransactionCallback<T> = (tx: PrismaTransactionClient) => Promise<T>;

@Injectable()
export class UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}
  async run<T>(
    callback: TransactionCallback<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(callback, {
        maxWait: options?.maxWait ?? 5000,
        timeout: options?.timeout ?? 10000,
      });
    } catch (error: unknown) {
      if (this.isPrismaKnownError(error)) {
        const prismaError = error as { code: string };
        throw new DatabaseError(`Transaction failed: ${prismaError.code}`, error);
      }
      throw new DatabaseError('Transaction failed with unknown error', error);
    }
  }

  private isPrismaKnownError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError;
  }
}
