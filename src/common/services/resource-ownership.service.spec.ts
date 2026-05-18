import { ResourceOwnershipService } from './resource-ownership.service';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { createTestModule } from '@/common/utils/test-helpers';

describe('ResourceOwnershipService', () => {
  let service: ResourceOwnershipService;
  let productRepo: { isOwnedBy: jest.Mock };

  beforeEach(async () => {
    productRepo = { isOwnedBy: jest.fn() };

    const module = await createTestModule({
      providers: [
        ResourceOwnershipService,
        { provide: INJECTION_TOKENS.PRODUCT_REPOSITORY, useValue: productRepo },
      ],
    });

    service = module.get<ResourceOwnershipService>(ResourceOwnershipService);
  });

  describe('isOwner', () => {
    it('should return true when userId matches resourceId for user resource', async () => {
      const result = await service.isOwner('user-1', 'user', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when userId differs from resourceId for user resource', async () => {
      const result = await service.isOwner('user-1', 'user', 'user-2');

      expect(result).toBe(false);
    });

    it('should delegate to product repository for product resource', async () => {
      productRepo.isOwnedBy.mockResolvedValue(true);

      const result = await service.isOwner('user-1', 'product', 'product-1');

      expect(result).toBe(true);
      expect(productRepo.isOwnedBy).toHaveBeenCalledWith('product-1', 'user-1');
    });

    it('should return false when product is not owned by user', async () => {
      productRepo.isOwnedBy.mockResolvedValue(false);

      const result = await service.isOwner('user-1', 'product', 'product-2');

      expect(result).toBe(false);
    });

    it('should return false for unknown resource type', async () => {
      const result = await service.isOwner('user-1', 'unknown-type', 'resource-1');

      expect(result).toBe(false);
    });
  });

  describe('registerHandler', () => {
    it('should register and use custom handler', async () => {
      service.registerHandler('custom', (resourceId: string, userId: string) =>
        resourceId.startsWith(userId),
      );

      const result1 = await service.isOwner('alice', 'custom', 'alice-resource');
      const result2 = await service.isOwner('alice', 'custom', 'bob-resource');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should override existing handler', async () => {
      service.registerHandler(
        'user',
        (resourceId: string, _userId: string) => resourceId === 'special-id',
      );

      const result1 = await service.isOwner('any-user', 'user', 'special-id');
      const result2 = await service.isOwner('any-user', 'user', 'normal-id');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });
});
