 

 
 
 

 
 
 
 
 
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AppLoggerService } from '@/common/services/logger.service';
import { AppError } from '@/common/errors/app.error';

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
      throw AppError.internalError(`Transaction context not found: ${transactionId}`, undefined, {
        transactionId,
      });
    }

    const logOperation = (operation: string) => {
      const operationStart = Date.now();
      context.operations.push({
        operation,
        timestamp: operationStart,
      });

      return () => {
        const duration = Date.now() - operationStart;
        const lastOp = context.operations[context.operations.length - 1];
        if (lastOp) {
          lastOp.duration = duration;
        }
      };
    };

    // Create transaction wrapper with logging
    const transactionWrapper = async (
      tx: import('@/generated/prisma/client').Prisma.TransactionClient,
    ) => {
      // Wrap common Prisma operations with logging
      const modelName = this.getModelName();
      const originalMethods = {
        findUnique: (tx as any)[modelName]?.findUnique?.bind(tx),
        findFirst: (tx as any)[modelName]?.findFirst?.bind(tx),
        findMany: (tx as any)[modelName]?.findMany?.bind(tx),
        create: (tx as any)[modelName]?.create?.bind(tx),
        update: (tx as any)[modelName]?.update?.bind(tx),
        delete: (tx as any)[modelName]?.delete?.bind(tx),
        count: (tx as any)[modelName]?.count?.bind(tx),
      };

      // Override methods with logging
      if ((tx as any)[modelName]) {
        const model = (tx as any)[modelName];

        model.findUnique = async (args: Record<string, unknown>) => {
          const endTimer = logOperation('findUnique');
          try {
            const result = await originalMethods.findUnique(args);
            endTimer();
            return result;
          } catch (error) {
            endTimer();
            throw error;
          }
        };

        model.findFirst = async (args: Record<string, unknown>) => {
          const endTimer = logOperation('findFirst');
          try {
            const result = await originalMethods.findFirst(args);
            endTimer();
            return result;
          } catch (error) {
            endTimer();
            throw error;
          }
        };

        model.findMany = async (args: Record<string, unknown>) => {
          const endTimer = logOperation('findMany');
          try {
            const result = await originalMethods.findMany(args);
            endTimer();
            return result;
          } catch (error) {
            endTimer();
            throw error;
          }
        };

        model.create = async (args: Record<string, unknown>) => {
          const endTimer = logOperation('create');
          try {
            const result = await originalMethods.create(args);
            endTimer();
            return result;
          } catch (error) {
            endTimer();
            throw error;
          }
        };

        model.update = async (args: Record<string, unknown>) => {
          const endTimer = logOperation('update');
          try {
            const result = await originalMethods.update(args);
            endTimer();
            return result;
          } catch (error) {
            endTimer();
            throw error;
          }
        };

        model.delete = async (args: Record<string, unknown>) => {
          const endTimer = logOperation('delete');
          try {
            const result = await originalMethods.delete(args);
            endTimer();
            return result;
          } catch (error) {
            endTimer();
            throw error;
          }
        };

        model.count = async (args: Record<string, unknown>) => {
          const endTimer = logOperation('count');
          try {
            const result = await originalMethods.count(args);
            endTimer();
            return result;
          } catch (error) {
            endTimer();
            throw error;
          }
        };
      }

      return await operations(tx);
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
          AppError.timeout(`Transaction timeout: ${transactionId}`, timeout, {
            transactionId,
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
      throw AppError.internalError(
        `Multiple transactions failed: ${errors.length} out of ${transactions.length}`,
        undefined,
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

  private getModelName(): string {
    // This is a placeholder - in real implementation,
    // this would be determined by the context or passed as parameter
    return 'model';
  }

  // Health check for transaction service
  async healthCheck(): Promise<{
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

    return {
      healthy: true,
      activeTransactions: activeTransactions.size,
      longestRunningTransaction,
    };
  }
}
