import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../user/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Decorator para especificar qué roles pueden acceder a un endpoint.
 * Acepta UserRole enum para type safety, pero también acepta strings para compatibilidad.
 * La jerarquía de roles se maneja automáticamente en RolesGuard.
 */
export const Roles = (...roles: (UserRole | string)[]) => SetMetadata(ROLES_KEY, roles);
