import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ResourceOwnershipService {
  constructor(private readonly dataSource: DataSource) {}

  async isOwner(userId: string, resource: string, resourceId: string): Promise<boolean> {
    switch (resource) {
      case 'user':
        return userId === resourceId;
      case 'product':
        return this.isProductOwner(resourceId, userId);
      default:
        return false;
    }
  }

  private async isProductOwner(productId: string, userId: string): Promise<boolean> {
    const result = await this.dataSource.manager.query<{ rowCount: number }>(
      'SELECT id FROM products WHERE id = $1 AND user_id = $2 LIMIT 1',
      [productId, userId],
    );
    return (result?.rowCount ?? 0) > 0;
  }
}
