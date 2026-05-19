import { Injectable } from '@nestjs/common';

type OwnershipHandler = (resourceId: string, userId: string) => boolean | Promise<boolean>;

@Injectable()
export class ResourceOwnershipService {
  private readonly handlers = new Map<string, OwnershipHandler>();

  constructor() {
    this.handlers.set('user', (resourceId, userId) => resourceId === userId);
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
