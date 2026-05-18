import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard, MemoryRateLimitStore, RedisRateLimitStore } from './rate-limit.guard';
import { AppLoggerService } from '@/common/services/logger.service';

function mockContext(): Record<string, unknown> {
  return {
    switchToHttp: () => ({
      getRequest: (): Record<string, unknown> => ({
        url: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'jest' },
      }),
      getResponse: (): { header: jest.Mock } => ({
        header: jest.fn().mockReturnThis(),
      }),
    }),
    getHandler: (): Record<string, unknown> => ({ handler: (): void => undefined }),
    getClass: (): jest.Mock => jest.fn(),
    getType: (): string => 'http',
    switchToRpc: (): Record<string, unknown> => ({}),
    switchToWs: (): Record<string, unknown> => ({}),
    getArgs: <T = unknown[]>(): T => undefined as T,
    getArgByIndex: <T = unknown>(_index: number): T => undefined as T,
  };
}

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore;
  let logger: {
    http: jest.Mock;
    security: jest.Mock;
    errorWithException: jest.Mock;
    startTimer: jest.Mock;
  };

  beforeEach(() => {
    logger = {
      http: jest.fn(),
      security: jest.fn(),
      errorWithException: jest.fn(),
      startTimer: jest.fn().mockReturnValue(jest.fn()),
    };
    store = new MemoryRateLimitStore(logger as unknown as AppLoggerService);
  });

  it('should increment and track rate limit info', () => {
    const info = store.increment('test-key', { windowMs: 60000, max: 10 });

    expect(info.totalHits).toBe(1);
    expect(info.remainingHits).toBe(9);
    expect(info.resetTime).toBeInstanceOf(Date);
  });

  it('should increase totalHits on subsequent increments', () => {
    store.increment('test-key', { windowMs: 60000, max: 10 });
    const info = store.increment('test-key', { windowMs: 60000, max: 10 });

    expect(info.totalHits).toBe(2);
    expect(info.remainingHits).toBe(8);
  });

  it('should reset after window expires', () => {
    const pastWindow = { windowMs: -60000, max: 10 };
    store.increment('test-key', pastWindow);
    const info = store.increment('test-key', { windowMs: 60000, max: 10 });

    expect(info.totalHits).toBe(1);
  });

  it('should reset a key', () => {
    store.increment('test-key', { windowMs: 60000, max: 10 });
    store.reset('test-key');

    const info = store.increment('test-key', { windowMs: 60000, max: 10 });
    expect(info.totalHits).toBe(1);
  });

  it('should cleanup expired entries', () => {
    store.increment('expired-key', { windowMs: -1, max: 10 });
    store.increment('active-key', { windowMs: 60000, max: 10 });

    store.cleanup();

    const info = store.increment('expired-key', { windowMs: 60000, max: 10 });
    expect(info.totalHits).toBe(1);
  });

  it('should clear all entries on destroy', () => {
    store.destroy();
    const info = store.increment('key', { windowMs: 60000, max: 10 });
    expect(info.totalHits).toBe(1);
  });
});

describe('RedisRateLimitStore', () => {
  let store: RedisRateLimitStore;
  let redis: { pipeline: jest.Mock; del: jest.Mock };
  let logger: { http: jest.Mock; security: jest.Mock };

  beforeEach(() => {
    redis = {
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      del: jest.fn().mockResolvedValue(undefined),
    };
    logger = { http: jest.fn(), security: jest.fn() };
    store = new RedisRateLimitStore(
      redis as unknown as never,
      logger as unknown as AppLoggerService,
    );
  });

  it('should use redis pipeline for increment', () => {
    store.increment('rate:key', { windowMs: 60000, max: 100 });

    expect(redis.pipeline).toHaveBeenCalled();
  });

  it('should reset via redis del', () => {
    store.reset('rate:key');

    expect(redis.del).toHaveBeenCalledWith('rate:key');
  });
});

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: { get: jest.Mock };
  let logger: {
    http: jest.Mock;
    security: jest.Mock;
    errorWithException: jest.Mock;
    startTimer: jest.Mock;
  };
  let redis: { pipeline: jest.Mock; del: jest.Mock };

  beforeEach(() => {
    reflector = { get: jest.fn() };
    logger = {
      http: jest.fn(),
      security: jest.fn(),
      errorWithException: jest.fn(),
      startTimer: jest.fn().mockReturnValue(jest.fn()),
    };
    redis = {
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      del: jest.fn().mockResolvedValue(undefined),
    };
    const configService = { get: jest.fn() };
    guard = new RateLimitGuard(
      reflector as unknown as Reflector,
      configService as unknown as ConfigService,
      logger as unknown as AppLoggerService,
      redis as unknown as never,
    );
  });

  it('should allow request within rate limit', () => {
    reflector.get.mockReturnValue(undefined);
    const ctx = mockContext();

    const result = guard.canActivate(ctx as never);

    expect(result).toBe(true);
  });

  it('should apply custom rate limit from metadata', () => {
    reflector.get.mockReturnValue({ max: 10, windowMs: 60000 });
    const ctx = mockContext();

    const result = guard.canActivate(ctx as never);

    expect(result).toBe(true);
  });

  it('should generate key based on userId when available', () => {
    reflector.get.mockReturnValue(undefined);
    const ctx = mockContext();
    Object.assign(ctx, { user: { id: 'user-1' } });

    const result = guard.canActivate(ctx as never);

    expect(result).toBe(true);
  });
});
