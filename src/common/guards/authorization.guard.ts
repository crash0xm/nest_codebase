import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  OnModuleInit,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AppLoggerService } from '@/common/services/logger.service';
import { ForbiddenError, UnauthorizedError } from '@/common/domain/errors/application.error';
import { ResourceOwnershipService } from '@/common/services/resource-ownership.service';
import type { AuthenticatedUser } from '@/common/guards/auth.guard';

export interface Permission {
  resource: string;
  action: string;
  conditions?: readonly string[];
}

export type AuthHttpRequest = FastifyRequest & { user?: AuthenticatedUser };

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
  USER: 'USER',
} as const;

export type RoleValue = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  USER_READ_OWN: { resource: 'user', action: 'read', conditions: ['own'] },
  USER_UPDATE_OWN: { resource: 'user', action: 'update', conditions: ['own'] },
  USER_DELETE_OWN: { resource: 'user', action: 'delete', conditions: ['own'] },
  USER_READ_ALL: { resource: 'user', action: 'read' },
  USER_UPDATE_ALL: { resource: 'user', action: 'update' },
  USER_DELETE_ALL: { resource: 'user', action: 'delete' },
  PRODUCT_READ: { resource: 'product', action: 'read' },
  PRODUCT_CREATE: { resource: 'product', action: 'create' },
  PRODUCT_UPDATE_OWN: { resource: 'product', action: 'update', conditions: ['own'] },
  PRODUCT_DELETE_OWN: { resource: 'product', action: 'delete', conditions: ['own'] },
  PRODUCT_UPDATE_ALL: { resource: 'product', action: 'update' },
  PRODUCT_DELETE_ALL: { resource: 'product', action: 'delete' },
} as const;

export const ROLE_PERMISSIONS: Readonly<Record<string, readonly Permission[]>> = {
  [ROLES.USER]: [
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_DELETE_OWN,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE_OWN,
    PERMISSIONS.PRODUCT_DELETE_OWN,
  ],
  [ROLES.MODERATOR]: [
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_DELETE_OWN,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE_OWN,
    PERMISSIONS.PRODUCT_DELETE_OWN,
    PERMISSIONS.PRODUCT_UPDATE_ALL,
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_DELETE_OWN,
    PERMISSIONS.USER_READ_ALL,
    PERMISSIONS.USER_UPDATE_ALL,
    PERMISSIONS.USER_DELETE_ALL,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE_OWN,
    PERMISSIONS.PRODUCT_DELETE_OWN,
    PERMISSIONS.PRODUCT_UPDATE_ALL,
    PERMISSIONS.PRODUCT_DELETE_ALL,
  ],
} as const;

export const PERMISSIONS_KEY = 'permissions';
export const ROLES_KEY = 'roles';

export const Permissions = (
  ...permissions: string[]
): import('@nestjs/common').CustomDecorator<string> => SetMetadata(PERMISSIONS_KEY, permissions);

export const Roles = (...roles: string[]): import('@nestjs/common').CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);

function validatePermissionFormat(perm: string): void {
  const parts = perm.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `[AuthorizationGuard] Invalid permission format: "${perm}". Expected "resource:action"`,
    );
  }
}

@Injectable()
export class AuthorizationGuard implements CanActivate, OnModuleInit {
  private validatedPermissions = false;

  constructor(
    private readonly reflector: Reflector,
    private readonly logger: AppLoggerService,
    private readonly ownershipService: ResourceOwnershipService,
  ) {}

  onModuleInit(): void {
    const allPermissions = Object.values(ROLE_PERMISSIONS).flat();
    for (const perm of allPermissions) {
      const permStr = `${perm.resource}:${perm.action}`;
      validatePermissionFormat(permStr);
    }
    this.validatedPermissions = true;
    this.logger.log('[AuthorizationGuard] Permission formats validated at startup');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthHttpRequest>();
    const { user } = request;

    if (!user) {
      this.logger.security('Unauthorized access attempt — no user on request', {
        path: request.url,
        method: request.method,
      });
      throw new UnauthorizedError('Authentication required');
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length && !requiredPermissions?.length) {
      return true;
    }

    if (user.role === ROLES.SUPER_ADMIN) {
      this.logger.auth('SUPER_ADMIN access granted', {
        userId: user.id,
        path: request.url,
        method: request.method,
      });
      return true;
    }

    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      this.logger.security('Access denied — insufficient role', {
        userId: user.id,
        userRole: user.role,
        requiredRoles,
        path: request.url,
        method: request.method,
        ip: request.ip,
      });
      throw new ForbiddenError('Insufficient role', { requiredRoles });
    }

    if (
      requiredPermissions?.length &&
      !this.hasRequiredPermissions(user, requiredPermissions, request)
    ) {
      this.logger.security('Access denied — insufficient permissions', {
        userId: user.id,
        userRole: user.role,
        requiredPermissions,
        path: request.url,
        method: request.method,
        ip: request.ip,
      });
      throw new ForbiddenError('Insufficient permissions', { requiredPermissions });
    }

    return true;
  }

  private hasRequiredPermissions(
    user: AuthenticatedUser,
    requiredPermissions: string[],
    request: AuthHttpRequest,
  ): boolean {
    return requiredPermissions.every((perm) => {
      validatePermissionFormat(perm);
      const parts = perm.split(':');
      const permission: Permission = { resource: parts[0], action: parts[1] };
      return this.checkPermission(user, permission, request);
    });
  }

  private checkPermission(
    user: AuthenticatedUser,
    permission: Permission,
    request: AuthHttpRequest,
  ): boolean {
    const userPermissions = ROLE_PERMISSIONS[user.role] ?? [];
    const matched = userPermissions.find(
      (p) => p.resource === permission.resource && p.action === permission.action,
    );
    if (!matched) return false;
    if (!matched.conditions?.length) return true;
    return this.checkConditions(user, matched, request);
  }

  private checkConditions(
    user: AuthenticatedUser,
    permission: Permission,
    request: AuthHttpRequest,
  ): boolean {
    return (permission.conditions ?? []).every((condition) => {
      switch (condition) {
        case 'own':
          return this.checkOwnership(user, permission.resource, request);
        default:
          this.logger.warn(`[AuthorizationGuard] Unknown condition: "${condition}"`);
          return false;
      }
    });
  }

  private checkOwnership(
    user: AuthenticatedUser,
    resource: string,
    request: AuthHttpRequest,
  ): boolean {
    const params = request.params as Record<string, string>;
    const resourceId = params['id'] ?? params['userId'] ?? params['productId'];
    if (!resourceId) return true; // collection endpoint — không áp dụng ownership
    return this.ownershipService.isOwner(user.id, resource, resourceId);
  }
}
