import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from '../user/user.entity';
import { getAllAccessibleRoles } from './role-utils';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: string | UserRole } | undefined;
    
    if (!user?.role) return false;

    // Convertir role a UserRole enum
    const userRole =
      typeof user.role === 'string'
        ? (user.role as UserRole)
        : user.role;

    // Convertir requiredRoles a UserRole[] si son strings
    const requiredRolesEnum: UserRole[] = requiredRoles.map(
      (r) => (typeof r === 'string' ? (r as UserRole) : r)
    );

    // Obtener todos los roles que el usuario puede acceder (incluyendo herencia)
    const accessibleRoles = getAllAccessibleRoles(userRole);

    // Verificar si alguno de los roles requeridos está en los roles accesibles
    return requiredRolesEnum.some((requiredRole) =>
      accessibleRoles.includes(requiredRole)
    );
  }
}
