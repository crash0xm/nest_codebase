import { PrismaService } from '@/modules/prisma/prisma.service';
import { AppLoggerService } from '@/common/services/logger.service';

export interface TestDatabase {
  reset: () => Promise<void>;
  close: () => Promise<void>;
  clear: (table?: string) => Promise<void>;
  seed: (data?: Record<string, unknown>) => Promise<void>;
  transaction: (callback: (tx: unknown) => Promise<void>) => Promise<void>;
}

export class TestBuilder<T> {
  private data: Partial<T> = {};

  constructor(private readonly _entityName: string) {}

  with<K extends keyof T>(key: K, value: T[K]): TestBuilder<T> {
    this.data[key] = value;
    return this;
  }

  without<K extends keyof T>(key: K): TestBuilder<T> {
    delete this.data[key];
    return this;
  }

  build(): Partial<T> {
    return { ...this.data };
  }

  toString(): string {
    return `TestBuilder<${this._entityName}>`;
  }
}

export class DatabaseTestHelper implements TestDatabase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  async reset(): Promise<void> {
    this.logger.trace('Resetting test database');

    // Delete all data in correct order to respect foreign keys
    // await this.prisma.product.deleteMany(); // Product model not available in current schema
    await this.prisma.user.deleteMany();

    this.logger.trace('Test database reset completed');
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
    this.logger.trace('Test database connection closed');
  }

  async clear(table?: string): Promise<void> {
    if (table != null && table.length > 0) {
      this.logger.trace(`Clearing table: ${table}`);

      switch (table.toLowerCase()) {
        case 'users':
          await this.prisma.user.deleteMany();
          break;
        case 'products':
          // await this.prisma.product.deleteMany(); // Product model not available
          break;
        default:
          this.logger.warn(`Unknown table for clearing: ${table}`);
      }
    } else {
      await this.reset();
    }
  }

  async seed(data?: Record<string, unknown>): Promise<void> {
    this.logger.trace('Seeding test database');

    if (data != null && data.users != null) {
      const model = this.getModel('user');
      if (model != null) {
        await (model as unknown as { createMany: (args: { data: unknown }) => Promise<unknown> }).createMany({
          data: data.users,
        });
      }
    }

    if (data != null && data.products != null) {
      // this.prisma.product.createMany({ // Product model not available
      //   data: data.products,
      // });
    }

    this.logger.trace('Test database seeding completed');
  }

  async transaction(callback: (tx: unknown) => Promise<void>): Promise<void> {
    await this.prisma.$transaction((tx) => {
      return callback(tx);
    });
  }

  async createTestData<T>(entity: string, data: Partial<T>[]): Promise<T[]> {
    const model = this.getModel(entity);
    if (model == null) {
      throw new Error(`Unknown entity: ${entity}`);
    }

    const result = await (model as unknown as { createMany: (args: { data: unknown }) => Promise<unknown> }).createMany({
      data,
    });
    return result as T[];
  }

  countEntities(entity: string): Promise<number> {
    const model = this.getModel(entity);
    if (model == null) {
      throw new Error(`Unknown entity: ${entity}`);
    }

    return (model as unknown as { count: () => Promise<number> }).count();
  }

  private getModel(entity: string): unknown {
    switch (entity.toLowerCase()) {
      case 'user':
        return this.prisma.user;
      case 'product':
        // return this.prisma.product; // Product model not available
        return null;
      default:
        return null;
    }
  }

  // Assertions for testing
  assertExists<T>(
    data: T | null | undefined,
  ): asserts data is T {
    if (data == null) {
      throw new Error(`Expected data to exist, but got ${String(data)}`);
    }
  }

  assertNotExists<T>(
    data: T | null | undefined,
  ): asserts data is null | undefined {
    if (data !== null && data !== undefined) {
      throw new Error(`Expected data to not exist, but got ${String(data)}`);
    }
  }

  assertEquals<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(message ?? `Expected ${String(expected)}, but got ${String(actual)}`);
    }
  }

  assertNotEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual === expected) {
      throw new Error(message ?? `Expected not ${String(expected)}, but got ${String(actual)}`);
    }
  }

  assertContains<T extends string>(
    actual: T,
    expected: string,
  ): void {
    if (!actual.includes(expected)) {
      throw new Error(`Expected "${actual}" to contain "${expected}"`);
    }
  }

  assertLength<T extends unknown[]>(
    actual: T,
    expectedLength: number,
  ): void {
    if (actual.length !== expectedLength) {
      throw new Error(`Expected length ${expectedLength}, but got ${actual.length}`);
    }
  }

  // Mock helpers
  createMock<T>(overrides?: Partial<T>): T {
    return overrides as T;
  }

  createMockArray<T>(length: number, overrides?: Partial<T>): T[] {
    return Array.from({ length }, () => this.createMock(overrides));
  }

  // Date helpers
  createFutureDate(days: number = 1): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  createPastDate(days: number = 1): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  // String helpers
  randomEmail(): string {
    return `test-${Math.random().toString(36).substr(2, 9)}@example.com`;
  }

  randomString(length: number = 10): string {
    return Math.random().toString(36).substr(2, length);
  }

  randomUUID(): string {
    return (
      Math.random().toString(36).substr(2, 9) +
      Math.random().toString(36).substr(2, 9)
    );
  }
}

export class TestTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }

  assertMaxTime(maxMs: number, message?: string): void {
    const elapsed = this.elapsed();
    if (elapsed > maxMs) {
      throw new Error(
        message ?? `Test took too long: ${elapsed}ms (max: ${maxMs}ms)`,
      );
    }
  }
}

// Global test setup utilities
export class TestSetup {
  static async setupTestDatabase(
    prisma: PrismaService,
    logger: AppLoggerService,
  ): Promise<TestDatabase> {
    const helper = new DatabaseTestHelper(prisma, logger);
    await helper.reset();
    return helper;
  }

  static async cleanupTestDatabase(helper: TestDatabase): Promise<void> {
    await helper.close();
  }
  static createTestContext(user?: { id: string; email: string; role: string }): {
    user: { id: string; email: string; role: string };
    requestId: string;
    traceId: string;
  } {
    return {
      user: user ?? {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'USER',
      },
      requestId: 'test-request-id',
      traceId: 'test-trace-id',
    };
  }
}
