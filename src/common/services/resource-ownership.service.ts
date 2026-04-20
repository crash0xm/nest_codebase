import { Injectable } from '@nestjs/common';

@Injectable()
export class ResourceOwnershipService {
  async isOwner(userId: string, resource: string, resourceId: string): Promise<boolean> {
    switch (resource) {
      case 'user':
        return userId === resourceId;
      case 'product':
        return this.isProductOwner(resourceId);
      default:
        return false;
    }
  }

  private async isProductOwner(_productId: string): Promise<boolean> {
    // TODO: Implement proper ownership check when owner field is added to Product schema
    // Current schema has no owner field on product.
    // Deny "own" checks for product until ownership columns are introduced.
    return false;
  }
}
