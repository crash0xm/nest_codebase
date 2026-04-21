import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Provider, Type, DynamicModule, ForwardReference } from '@nestjs/common';

// Mock providers for testing
export const mockProviders = {
  // Cache Manager
  CACHE_MANAGER: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    reset: jest.fn(),
  },

  // Logger Service
  AppLoggerService: {
    recordMetric: jest.fn(),
    recordDuration: jest.fn(),
    startTimer: jest.fn(),
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },

  // Config Service
  ConfigService: {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  },
};

// Performance metrics tokens
export const PERFORMANCE_TOKENS = {
  CACHE_HITS_TOTAL: 'PROM_METRIC_CACHE_HITS_TOTAL',
  CACHE_MISSES_TOTAL: 'PROM_METRIC_CACHE_MISSES_TOTAL',
  ACTIVE_SESSIONS_TOTAL: 'PROM_METRIC_ACTIVE_SESSIONS_TOTAL',
};

export interface TestModuleOptions {
  providers?: Provider[];
  imports?: Array<Type | DynamicModule | Promise<DynamicModule> | ForwardReference>;
}

export async function createTestModule(options: TestModuleOptions = {}): Promise<TestingModule> {
  const defaultProviders = [
    ...Object.entries(mockProviders).map(([key, value]) => ({
      provide: key,
      useValue: value,
    })),
    ...Object.values(PERFORMANCE_TOKENS).map((token) => ({
      provide: token,
      useValue: {
        inc: jest.fn(),
        dec: jest.fn(),
        set: jest.fn(),
        recordMetric: jest.fn(), // Keep for backward compatibility
      },
    })),
  ];

  const defaultImports = [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ];

  return Test.createTestingModule({
    imports: [...defaultImports, ...(options.imports ?? [])],
    providers: [...defaultProviders, ...(options.providers ?? [])],
  }).compile();
}

export function createMockRepository<T extends Record<string, unknown>>(
  methods: Partial<T> = {},
): T {
  const mock = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    existsByEmail: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    ...methods,
  } as unknown as T;

  return mock;
}

export function createMockAuthService(): Record<string, jest.Mock> {
  return {
    validateUser: jest.fn(),
    generateTokens: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
  };
}

export function createMockJwtService(): Record<string, jest.Mock> {
  return {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  };
}

export function createMockConfigService(): Record<string, jest.Mock> {
  return {
    get: jest.fn((key: string): unknown => {
      const configMap: Record<string, unknown> = {
        app: {
          nodeEnv: 'development',
          port: 3000,
          name: 'NestJS SaaS',
          apiPrefix: 'api/v1',
          apiVersion: '1',
          shutdownTimeout: 30000,
          fallbackLanguage: 'en',
          corsOrigin: '*',
        },
        auth: {
          accessTokenSecret: 'test-secret',
          refreshTokenSecret: 'test-refresh-secret',
          accessTokenExpiresIn: 900,
          refreshTokenExpiresIn: 604800,
        },
        database: {
          url: 'postgresql://localhost:5432/testdb',
        },
        redis: {
          host: 'localhost',
          port: 6379,
        },
      };

      return configMap[key] ?? null;
    }),
  };
}

export function createMockClsService(): {
  get: jest.Mock;
  set: jest.Mock;
  run: jest.Mock;
} {
  return {
    get: jest.fn(),
    set: jest.fn(),
    run: jest.fn(),
  };
}
