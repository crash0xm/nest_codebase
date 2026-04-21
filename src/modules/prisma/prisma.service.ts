import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '../../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      accelerateUrl:
        process.env.DATABASE_URL ?? 'postgresql://username:password@localhost:5432/database_name',
      errorFormat: 'pretty',
    });
  }

  async onModuleInit(): Promise<void> {
    // Prisma v7+ connects automatically, no need to call $connect()
  }

  async onModuleDestroy(): Promise<void> {
    // Prisma v7+ disconnects automatically, but you can still call it if needed
    await this.$disconnect();
  }

  // Transaction helper
  async runInTransaction<T>(fn: (prisma: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      return fn(tx);
    });
  }
}
