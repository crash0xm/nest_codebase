import { ConfigService } from '@nestjs/config';
import { RedisTokenStore } from './redis-token-store';

describe('RedisTokenStore', () => {
  let store: RedisTokenStore;
  let duplicateClient: {
    select: jest.Mock;
    on: jest.Mock;
    multi: jest.Mock;
    setex: jest.Mock;
    zadd: jest.Mock;
    zcard: jest.Mock;
    zrange: jest.Mock;
    zrem: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    exists: jest.Mock;
    quit: jest.Mock;
    pipeline: jest.Mock;
  };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    duplicateClient = {
      select: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      multi: jest.fn(),
      setex: jest.fn(),
      zadd: jest.fn(),
      zcard: jest.fn(),
      zrange: jest.fn(),
      zrem: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
      pipeline: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'cache.keyPrefix') return 'cache:';
        if (key === 'auth.session.maxActive') return 5;
        return undefined;
      }),
    };

    store = new RedisTokenStore(
      configService as unknown as ConfigService,
      { duplicate: jest.fn().mockReturnValue(duplicateClient) } as unknown as never,
    );
  });

  describe('save', () => {
    it('should store hashed token and add to session tracker', async () => {
      const multiExec = jest.fn().mockResolvedValue([
        [null, 'OK'],
        [null, 1],
      ]);
      duplicateClient.multi = jest.fn().mockReturnValue({
        setex: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        exec: multiExec,
      });
      duplicateClient.zcard.mockResolvedValue(1);

      await store.save('user-1', 'token-1', 'raw-token', 3600);

      expect(duplicateClient.multi).toHaveBeenCalled();
      expect(multiExec).toHaveBeenCalled();
    });

    it('should prune old sessions when exceeding max', async () => {
      const multiExec = jest.fn().mockResolvedValue([
        [null, 'OK'],
        [null, 1],
      ]);
      duplicateClient.multi = jest.fn().mockReturnValue({
        setex: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        exec: multiExec,
      });
      duplicateClient.zcard.mockResolvedValue(6);
      duplicateClient.zrange.mockResolvedValue(['token-old']);

      const pruneMulti = {
        del: jest.fn().mockReturnThis(),
        zrem: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      duplicateClient.multi = jest
        .fn()
        .mockReturnValueOnce({
          setex: jest.fn().mockReturnThis(),
          zadd: jest.fn().mockReturnThis(),
          exec: multiExec,
        })
        .mockReturnValueOnce(pruneMulti);

      await store.save('user-1', 'token-1', 'raw-token', 3600);

      expect(duplicateClient.zrange).toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('should return false if no stored hash', async () => {
      duplicateClient.get.mockResolvedValue(null);

      const result = await store.verify('user-1', 'token-1', 'raw-token');

      expect(result).toBe(false);
    });
  });

  describe('revoke', () => {
    it('should delete token and remove from session set', async () => {
      const multiExec = jest.fn().mockResolvedValue([
        [null, 1],
        [null, 1],
      ]);
      duplicateClient.multi = jest.fn().mockReturnValue({
        del: jest.fn().mockReturnThis(),
        zrem: jest.fn().mockReturnThis(),
        exec: multiExec,
      });

      await store.revoke('user-1', 'token-1');

      expect(multiExec).toHaveBeenCalled();
    });
  });

  describe('revokeAll', () => {
    it('should revoke all sessions for a user', async () => {
      duplicateClient.zrange.mockResolvedValue(['t1', 't2']);
      const multiExec = jest.fn().mockResolvedValue([]);
      duplicateClient.multi = jest.fn().mockReturnValue({
        del: jest.fn().mockReturnThis(),
        zrem: jest.fn().mockReturnThis(),
        exec: multiExec,
      });

      await store.revokeAll('user-1');

      expect(duplicateClient.zrange).toHaveBeenCalled();
      expect(multiExec).toHaveBeenCalled();
    });

    it('should handle empty sessions gracefully', async () => {
      duplicateClient.zrange.mockResolvedValue([]);

      await store.revokeAll('user-1');

      expect(duplicateClient.multi).not.toHaveBeenCalled();
    });
  });

  describe('access token blacklist', () => {
    it('should blacklist and check access tokens', async () => {
      duplicateClient.setex.mockResolvedValue('OK');
      duplicateClient.exists.mockResolvedValue(1);

      await store.blacklistAccessToken('jti-1', 900);
      const result = await store.isAccessTokenBlacklisted('jti-1');

      expect(duplicateClient.setex).toHaveBeenCalledWith('cache:blacklist:jti-1', 900, '1');
      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted tokens', async () => {
      duplicateClient.exists.mockResolvedValue(0);

      const result = await store.isAccessTokenBlacklisted('jti-2');

      expect(result).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('should quit redis on module destroy', async () => {
      await store.onModuleDestroy();

      expect(duplicateClient.quit).toHaveBeenCalled();
    });
  });
});
