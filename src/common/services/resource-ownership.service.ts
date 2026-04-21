import { Injectable } from '@nestjs/common';

@Injectable()
export class ResourceOwnershipService {
  isOwner(userId: string, resource: string, resourceId: string): boolean {
    switch (resource) {
      case 'user':
        return userId === resourceId;
      case 'product':
        return this.isProductOwner(resourceId);
      default:
        return false;
    }
  }

  private isProductOwner(_productId: string): boolean {
    return false;
  }
}
