import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AppLoggerService } from '@/common/services/logger.service';
import { ForbiddenError, UnauthorizedError } from '@/common/domain/errors/application.error';
import { ResourceOwnershipService } from '@/common/services/resource-ownership.service';

export interface Permission {
  resource: string;
  action: string;
  conditions?: readonly string[];
}

export interface Role {
  name: string;
  permissions: Permission[];
}

export interface AuthUser {
  id: string;
  role: string;
}

export type AuthHttpRequest = FastifyRequest & { user?: AuthUser };

export const ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  MODERATOR: 'MODERATOR',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export const PERMISSIONS = {
  // User permissions
  USER_READ_OWN: { resource: 'user', action: 'read', conditions: ['own'] },
  USER_UPDATE_OWN: { resource: 'user', action: 'update', conditions: ['own'] },
  USER_DELETE_OWN: { resource: 'user', action: 'delete', conditions: ['own'] },

  // Product permissions
  PRODUCT_READ: { resource: 'product', action: 'read' },
  PRODUCT_CREATE: { resource: 'product', action: 'create' },
  PRODUCT_UPDATE_OWN: {
    resource: 'product',
    action: 'update',
    conditions: ['own'],
  },
  PRODUCT_DELETE_OWN: {
    resource: 'product',
    action: 'delete',
    conditions: ['own'],
  },

  // Admin permissions
  USER_READ_ALL: { resource: 'user', action: 'read' },
  USER_UPDATE_ALL: { resource: 'user', action: 'update' },
  USER_DELETE_ALL: { resource: 'user', action: 'delete' },
  PRODUCT_UPDATE_ALL: { resource: 'product', action: 'update' },
  PRODUCT_DELETE_ALL: { resource: 'product', action: 'delete' },
} as const;

export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
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
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE_OWN,
    PERMISSIONS.PRODUCT_DELETE_OWN,
    PERMISSIONS.PRODUCT_UPDATE_ALL,
    PERMISSIONS.USER_READ_ALL,
    PERMISSIONS.USER_UPDATE_ALL,
    PERMISSIONS.PRODUCT_DELETE_ALL,
  ],
  [ROLES.SUPER_ADMIN]: [
    // Super admin has all permissions
  ],
};

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: AppLoggerService,
    private readonly ownershipService: ResourceOwnershipService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthHttpRequest>();
    const { user } = request;

    // Check if user is authenticated
    if (!user) {
      this.logger.security('Unauthorized access attempt - no user found', {
        path: request.url,
        method: request.method,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      throw new UnauthorizedError('Authentication required');
    }

    // Get required permissions from metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    try {
      // Check if user has required roles
      if (
        requiredRoles &&
        requiredRoles.length > 0 &&
        !this.hasRequiredRoles(user.role, requiredRoles)
      ) {
        this.logger.security('Access denied - insufficient role', {
          userId: user.id,
          userRole: user.role,
          requiredRoles,
          path: request.url,
          method: request.method,
          ip: request.ip,
        });

        throw new ForbiddenError('Insufficient permissions', { requiredRoles });
      }

      // Check if user has required permissions
      if (
        requiredPermissions &&
        requiredPermissions.length > 0 &&
        !this.hasRequiredPermissions(user, requiredPermissions, request)
      ) {
        this.logger.security('Access denied - insufficient permissions', {
          userId: user.id,
          userRole: user.role,
          requiredPermissions,
          path: request.url,
          method: request.method,
          ip: request.ip,
        });

        throw new ForbiddenError('Insufficient permissions', { requiredPermissions });
      }

      // Log successful authorization
      this.logger.auth('Access granted', {
        userId: user.id,
        userRole: user.role,
        requiredRoles,
        requiredPermissions,
        path: request.url,
        method: request.method,
      });

      return true;
    } catch (error) {
      this.logger.errorWithException('Authorization guard error', error as Error, undefined, {
        userId: user.id,
        path: request.url,
        method: request.method,
      });

      if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
        throw error;
      }
      throw new ForbiddenError('Authorization failed');
    }
  }

  private hasRequiredRoles(userRole: string, requiredRoles: string[]): boolean {
    return requiredRoles.includes(userRole);
  }

  hasRequiredPermissions(
    user: AuthUser,
    requiredPermissions: string[],
    request: AuthHttpRequest,
  ): boolean {
    return requiredPermissions.every((requiredPermission) => {
      const permission = this.parsePermission(requiredPermission);
      return this.checkPermission(user, permission, request);
    });
  }

  private parsePermission(permissionString: string): Permission {
    const [resource, action] = permissionString.split(':');
    return { resource, action };
  }

  checkPermission(user: AuthUser, permission: Permission, request: AuthHttpRequest): boolean {
    if (user.role === ROLES.SUPER_ADMIN) {
      return true;
    }

    const userPermissions = ROLE_PERMISSIONS[user.role] ?? [];

    const matchedPermission = userPermissions.find(
      (userPermission) =>
        userPermission.resource === permission.resource &&
        userPermission.action === permission.action,
    );

    if (!matchedPermission) {
      return false;
    }

    if (matchedPermission.conditions && matchedPermission.conditions.length > 0) {
      return this.checkConditions(user, matchedPermission, request);
    }

    return true;
  }

  private checkConditions(
    user: AuthUser,
    permission: Permission,
    request: AuthHttpRequest,
  ): boolean {
    if (!permission.conditions || permission.conditions.length === 0) {
      return true;
    }

    return permission.conditions.every((condition) => {
      switch (condition) {
        case 'own':
          return this.checkOwnership(user, permission.resource, request);
        default:
          return false;
      }
    });
  }

  private checkOwnership(user: AuthUser, resource: string, request: AuthHttpRequest): boolean {
    const params = request.params as Record<string, string>;
    const resourceId = params.id ?? params.userId ?? params.productId;

    if (!resourceId) {
      return false;
    }

    return this.ownershipService.isOwner(user.id, resource, resourceId);
  }
}

// Decorators for setting required permissions/roles
export const Permissions =
  (...permissions: string[]) =>
  (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const handler: unknown = descriptor.value;
    if (handler !== undefined) {
      Reflect.defineMetadata('permissions', permissions, handler as object);
    }
    return descriptor;
  };

export const Roles =
  (...roles: string[]) =>
  (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const handler: unknown = descriptor.value;
    if (handler !== undefined) {
      Reflect.defineMetadata('roles', roles, handler as object);
    }
    return descriptor;
  };
