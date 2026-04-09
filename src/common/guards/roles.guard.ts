import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES } from './authorization.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userRole = user.role;
    if (!userRole) {
      throw new ForbiddenException('User role not defined');
    }

    // Check if user has any of the required roles
    const hasRequiredRole = requiredRoles.some((role) => {
      if (role === ROLES.ADMIN) {
        return userRole === ROLES.ADMIN;
      }
      if (role === ROLES.USER) {
        return userRole === ROLES.USER || userRole === ROLES.ADMIN || userRole === ROLES.MODERATOR;
      }
      if (role === ROLES.MODERATOR) {
        return userRole === ROLES.MODERATOR || userRole === ROLES.ADMIN;
      }
      return userRole === role;
    });

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
