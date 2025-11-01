import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from '../user/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: string | UserRole } | undefined;
    if (!user?.role) return false;

    // Convertir role a string (los valores del enum ya son strings)
    const userRoleString =
      typeof user.role === 'string' ? user.role : (user.role as UserRole);

    // head-manager tiene todos los permisos de manager + los suyos propios
    if (userRoleString === UserRole.HEAD_MANAGER) {
      return (
        requiredRoles.includes(UserRole.HEAD_MANAGER) ||
        requiredRoles.includes(UserRole.MANAGER)
      );
    }

    return requiredRoles.includes(userRoleString);
  }
}
