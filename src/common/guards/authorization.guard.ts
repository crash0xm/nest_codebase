import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppLoggerService } from '@/common/services/logger.service';
import { AppError } from '@/common/errors/app.error';

export interface Permission {
  resource: string;
  action: string;
  conditions?: readonly string[];
}

export interface Role {
  name: string;
  permissions: Permission[];
}

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
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    // Check if user is authenticated
    if (!user) {
      this.logger.security('Unauthorized access attempt - no user found', {
        path: request.path,
        method: request.method,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      throw AppError.unauthorized('Authentication required');
    }

    // Get required permissions from metadata
    const requiredPermissions = this.reflector.get<string[]>('permissions', context.getHandler());
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());

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
          path: request.path,
          method: request.method,
          ip: request.ip,
        });

        throw AppError.forbidden('Insufficient permissions');
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
          path: request.path,
          method: request.method,
          ip: request.ip,
        });

        throw AppError.forbidden('Insufficient permissions');
      }

      // Log successful authorization
      this.logger.auth('Access granted', {
        userId: user.id,
        userRole: user.role,
        requiredRoles,
        requiredPermissions,
        path: request.path,
        method: request.method,
      });

      return true;
    } catch (error) {
      this.logger.errorWithException('Authorization guard error', error as Error, undefined, {
        userId: user.id,
        path: request.path,
        method: request.method,
      });

      throw AppError.forbidden('Authorization failed');
    }
  }

  private hasRequiredRoles(userRole: string, requiredRoles: string[]): boolean {
    return requiredRoles.includes(userRole);
  }

  private hasRequiredPermissions(
    user: { id: string; role: string },
    requiredPermissions: string[],
    request: { params: Record<string, string> },
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

  private checkPermission(
    user: { id: string; role: string },
    permission: Permission,
    request: { params: Record<string, string> },
  ): boolean {
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];

    const hasPermission = userPermissions.some(
      (userPermission) =>
        userPermission.resource === permission.resource &&
        userPermission.action === permission.action,
    );

    if (!hasPermission) {
      return false;
    }

    // Check conditions if specified
    if (permission.conditions && permission.conditions.length > 0) {
      return this.checkConditions(user, permission, request);
    }

    return true;
  }

  private checkConditions(
    user: { id: string; role: string },
    permission: Permission,
    request: { params: Record<string, string> },
  ): boolean {
    if (!permission.conditions || permission.conditions.length === 0) {
      return true;
    }

    return permission.conditions.every((condition) => {
      switch (condition) {
        case 'own':
          return this.checkOwnership(user, permission.resource, request);
        default:
          return true; // Unknown condition, allow by default
      }
    });
  }

  private checkOwnership(
    user: { id: string; role: string },
    resource: string,
    request: { params: Record<string, string> },
  ): boolean {
    // Extract resource ID from request parameters
    const resourceId = request.params.id || request.params.userId || request.params.productId;

    if (!resourceId) {
      return false;
    }

    // Check if user owns the resource
    switch (resource) {
      case 'user':
        return user.id === resourceId;
      case 'product':
        return this.checkProductOwnershipSync(user.id, resourceId);
      default:
        return false;
    }
  }

  private checkProductOwnershipSync(userId: string, productId: string): boolean {
    // This would typically involve a database call
    // For now, we'll implement a simple check
    // In a real implementation, you would query the database
    return Boolean(userId && productId); // Placeholder implementation
  }
}

// Decorators for setting required permissions/roles
export const Permissions =
  (...permissions: string[]) =>
  (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('permissions', permissions, descriptor.value);
    return descriptor;
  };

export const Roles =
  (...roles: string[]) =>
  (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('roles', roles, descriptor.value);
    return descriptor;
  };
