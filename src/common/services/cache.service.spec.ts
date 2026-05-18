import { CacheService } from './cache.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { createTestModule } from '@/common/utils/test-helpers';

describe('CacheService', () => {
  let service: CacheService;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module = await createTestModule({
      providers: [CacheService, { provide: CACHE_MANAGER, useValue: cacheManager }],
    });

    service = module.get<CacheService>(CacheService);
  });

  describe('get', () => {
    it('should return cached value when key exists', async () => {
      cacheManager.get.mockResolvedValue({ id: 1, name: 'test' });

      const result = await service.get('test-key');

      expect(result).toEqual({ id: 1, name: 'test' });
      expect(cacheManager.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });

    it('should return null when cache returns undefined', async () => {
      cacheManager.get.mockResolvedValue(undefined);

      const result = await service.get('undefined-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store value without TTL', async () => {
      await service.set('key', 'value');

      expect(cacheManager.set).toHaveBeenCalledWith('key', 'value', undefined);
    });

    it('should store value with TTL', async () => {
      await service.set('key', 'value', 5000);

      expect(cacheManager.set).toHaveBeenCalledWith('key', 'value', 5000);
    });
  });

  describe('del', () => {
    it('should delete existing key', async () => {
      cacheManager.del.mockResolvedValue(undefined);

      await service.del('key-to-delete');

      expect(cacheManager.del).toHaveBeenCalledWith('key-to-delete');
    });
  });

  describe('invalidateByTag', () => {
    it('should not throw', async () => {
      await expect(service.invalidateByTag('any-tag')).resolves.toBeUndefined();
    });
  });
});
