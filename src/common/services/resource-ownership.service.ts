import { Injectable, Inject } from '@nestjs/common';
import { IProductRepository } from '@/modules/product/domain/repositories/product.repository.interface';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';

type OwnershipHandler = (resourceId: string, userId: string) => boolean | Promise<boolean>;

@Injectable()
export class ResourceOwnershipService {
  private readonly handlers = new Map<string, OwnershipHandler>();

  constructor(
    @Inject(INJECTION_TOKENS.PRODUCT_REPOSITORY)
    private readonly productRepo: IProductRepository,
  ) {
    this.handlers.set('user', (resourceId, userId) => resourceId === userId);
    this.handlers.set('product', (productId, userId) =>
      this.productRepo.isOwnedBy(productId, userId),
    );
  }

  async isOwner(userId: string, resource: string, resourceId: string): Promise<boolean> {
    const handler = this.handlers.get(resource);
    if (!handler) return false;
    return handler(resourceId, userId);
  }

  registerHandler(resource: string, handler: OwnershipHandler): void {
    this.handlers.set(resource, handler);
  }
}
