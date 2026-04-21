import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AppLoggerService } from '@/common/services/logger.service';
import { ApplicationError } from '@/common/domain/errors/application.error';

export interface TransactionOptions {
  timeout?: number;
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
}

export interface TransactionContext {
  transactionId: string;
  startTime: number;
  operations: Array<{
    operation: string;
    timestamp: number;
    duration?: number;
  }>;
}

@Injectable()
export class TransactionService {
  private activeTransactions = new Map<string, TransactionContext>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  async runInTransaction<T>(
    operations: (tx: import('@/generated/prisma/client').Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    return this.executeTransactionWithLogging<T>(operations, options);
  }

  private async executeTransactionWithLogging<T>(
    operations: (tx: import('@/generated/prisma/client').Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const transactionId = this.generateTransactionId();
    const startTime = Date.now();

    const context: TransactionContext = {
      transactionId,
      startTime,
      operations: [],
    };

    this.activeTransactions.set(transactionId, context);

    try {
      this.logger.database(`Transaction started: ${transactionId}`, {
        transactionId,
        isolationLevel: options?.isolationLevel,
        timeout: options?.timeout,
      });

      const result = await this.executeTransactionInternal(operations, transactionId, options);

      const duration = Date.now() - startTime;

      this.logger.database(`Transaction completed: ${transactionId}`, {
        transactionId,
        duration,
        operationCount: context.operations.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.errorWithException(
        `Transaction failed: ${transactionId}`,
        error as Error,
        undefined,
        {
          transactionId,
          duration,
          operationCount: context.operations.length,
        },
      );

      throw error;
    } finally {
      this.activeTransactions.delete(transactionId);
    }
  }

  private async executeTransactionInternal<T>(
    operations: (tx: import('@/generated/prisma/client').Prisma.TransactionClient) => Promise<T>,
    transactionId: string,
    options?: TransactionOptions,
  ): Promise<T> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new ApplicationError(
        `Transaction context not found: ${transactionId}`,
        'INTERNAL_ERROR',
        500,
        {
          transactionId,
        },
      );
    }

    const transactionWrapper = async (
      tx: import('@/generated/prisma/client').Prisma.TransactionClient,
    ): Promise<T> => {
      context.operations.push({
        operation: 'transaction',
        timestamp: Date.now(),
      });

      return operations(tx);
    };

    // Execute transaction with options
    if (options?.timeout) {
      return Promise.race([
        this.prisma.$transaction(transactionWrapper),
        this.createTimeoutPromise(options.timeout, transactionId),
      ]);
    }

    return this.prisma.$transaction(transactionWrapper);
  }

  private createTimeoutPromise(timeout: number, transactionId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new ApplicationError(`Transaction timeout: ${transactionId}`, 'TIMEOUT', 408, {
            transactionId,
            timeout,
          }),
        );
      }, timeout);
    });
  }

  async runMultipleTransactions<T>(
    transactions: Array<{
      operations: (tx: import('@/generated/prisma/client').Prisma.TransactionClient) => Promise<T>;
      options?: TransactionOptions;
    }>,
  ): Promise<T[]> {
    const results: T[] = [];
    const errors: Error[] = [];

    for (const { operations, options } of transactions) {
      try {
        const result = await this.runInTransaction(operations, options);
        results.push(result);
      } catch (error) {
        errors.push(error as Error);
      }
    }

    if (errors.length > 0) {
      throw new ApplicationError(
        `Multiple transactions failed: ${errors.length} out of ${transactions.length}`,
        'INTERNAL_ERROR',
        500,
        {
          totalTransactions: transactions.length,
          failedTransactions: errors.length,
          errors: errors.map((e) => e.message),
        },
      );
    }

    return results;
  }

  getActiveTransaction(transactionId: string): TransactionContext | undefined {
    return this.activeTransactions.get(transactionId);
  }

  getActiveTransactions(): Map<string, TransactionContext> {
    return new Map(this.activeTransactions);
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Health check for transaction service
  healthCheck(): Promise<{
    healthy: boolean;
    activeTransactions: number;
    longestRunningTransaction?: {
      id: string;
      duration: number;
    };
  }> {
    const activeTransactions = this.getActiveTransactions();
    let longestRunningTransaction: { id: string; duration: number } | undefined;

    const now = Date.now();
    for (const [id, context] of activeTransactions) {
      const duration = now - context.startTime;
      if (!longestRunningTransaction || duration > longestRunningTransaction.duration) {
        longestRunningTransaction = { id, duration };
      }
    }

    return Promise.resolve({
      healthy: true,
      activeTransactions: activeTransactions.size,
      longestRunningTransaction,
    });
  }
}
