import { DataSource, EntityManager } from 'typeorm';
import { AppLoggerService } from '@/common/services/logger.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRecord = Record<string, any>;

export interface TestDatabase {
  reset: () => Promise<void>;
  close: () => Promise<void>;
  clear: (table?: string) => Promise<void>;
  seed: (data?: { users?: RawRecord[]; products?: RawRecord[] }) => Promise<void>;
  transaction: (callback: (manager: EntityManager) => Promise<void>) => Promise<void>;
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
    private readonly dataSource: DataSource,
    private readonly logger: AppLoggerService,
  ) {}

  async reset(): Promise<void> {
    this.logger.trace('Resetting test database');

    const entities = this.dataSource.entityMetadatas;
    const tableNames = entities.map((e) => `"${e.tableName}"`).join(', ');
    await this.dataSource.query(`TRUNCATE TABLE ${tableNames} CASCADE`);

    this.logger.trace('Test database reset completed');
  }

  async close(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
    this.logger.trace('Test database connection closed');
  }

  async clear(table?: string): Promise<void> {
    if (table) {
      this.logger.trace(`Clearing table: ${table}`);
      await this.dataSource.query(`DELETE FROM "${table}"`);
    } else {
      await this.reset();
    }
  }

  async seed(data?: { users?: unknown[]; products?: unknown[] }): Promise<void> {
    this.logger.trace('Seeding test database');

    const userRepo = this.dataSource.getRepository('users');
    const productRepo = this.dataSource.getRepository('products');

    if (data?.users?.length) {
      await userRepo.save(data.users);
    }

    if (data?.products?.length) {
      await productRepo.save(data.products);
    }

    this.logger.trace('Test database seeding completed');
  }

  async transaction(callback: (manager: EntityManager) => Promise<void>): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await callback(manager);
    });
  }

  async createTestData<T>(entity: string, data: Partial<T>[]): Promise<T[]> {
    const repo = this.dataSource.getRepository(entity);
    const result = await repo.save(data);
    return result as T[];
  }

  async countEntities(entity: string): Promise<number> {
    const repo = this.dataSource.getRepository(entity);
    return repo.count();
  }

  // Assertions for testing
  assertExists<T>(data: T | null | undefined, message?: string): asserts data is T {
    if (data === null || data === undefined) {
      throw new Error(message ?? `Expected data to exist, but got ${String(data)}`);
    }
  }

  assertNotExists<T>(
    data: T | null | undefined,
    message?: string,
  ): asserts data is null | undefined {
    if (data !== null && data !== undefined) {
      throw new Error(message ?? `Expected data to not exist, but got ${JSON.stringify(data)}`);
    }
  }

  assertEquals<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(
        message ?? `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`,
      );
    }
  }

  assertNotEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual === expected) {
      throw new Error(
        message ?? `Expected not ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`,
      );
    }
  }

  assertContains<T extends string>(actual: T, expected: string, message?: string): void {
    if (!actual.includes(expected)) {
      throw new Error(message ?? `Expected "${actual}" to contain "${expected}"`);
    }
  }

  assertLength<T extends unknown[]>(actual: T, expectedLength: number, message?: string): void {
    if (actual.length !== expectedLength) {
      throw new Error(message ?? `Expected length ${expectedLength}, but got ${actual.length}`);
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
    return Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
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
      throw new Error(message ?? `Test took too long: ${elapsed}ms (max: ${maxMs}ms)`);
    }
  }
}

// Global test setup utilities
export class TestSetup {
  static async setupTestDatabase(
    dataSource: DataSource,
    logger: AppLoggerService,
  ): Promise<TestDatabase> {
    const helper = new DatabaseTestHelper(dataSource, logger);
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
