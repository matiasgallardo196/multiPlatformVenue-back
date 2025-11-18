import { UserRole } from '../user/user.entity';

// Definir la jerarquía de roles: cada rol hereda los permisos de los roles inferiores
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  [UserRole.ADMIN]: [
    UserRole.HEAD_MANAGER,
    UserRole.MANAGER,
    UserRole.STAFF,
  ],
  [UserRole.HEAD_MANAGER]: [
    UserRole.MANAGER,
    UserRole.STAFF,
  ],
  [UserRole.MANAGER]: [
    UserRole.STAFF,
  ],
  [UserRole.STAFF]: [], // STAFF no hereda de nadie
};

/**
 * Obtiene todos los roles que un rol dado puede acceder (incluyendo sí mismo y sus heredados)
 */
export function getAllAccessibleRoles(role: UserRole): UserRole[] {
  const inheritedRoles = ROLE_HIERARCHY[role] || [];
  // Incluir el rol mismo y todos los roles heredados (transitivamente)
  const allRoles = [role, ...inheritedRoles];
  
  // Aplanar recursivamente para incluir roles heredados de los heredados
  const flattened: UserRole[] = [];
  const processRole = (r: UserRole) => {
    if (!flattened.includes(r)) {
      flattened.push(r);
      const inherited = ROLE_HIERARCHY[r] || [];
      inherited.forEach(processRole);
    }
  };
  
  allRoles.forEach(processRole);
  return flattened;
}

/**
 * Verifica si un rol tiene acceso a otro rol (incluyendo herencia de jerarquía)
 * @param userRole El rol del usuario
 * @param requiredRole El rol requerido
 * @returns true si el usuario tiene el rol requerido o un rol superior que lo incluye
 */
export function hasRoleOrAbove(userRole: UserRole, requiredRole: UserRole): boolean {
  const accessibleRoles = getAllAccessibleRoles(userRole);
  return accessibleRoles.includes(requiredRole);
}

/**
 * Verifica si un usuario es ADMIN
 */
export function isAdmin(role: UserRole | string): boolean {
  return role === UserRole.ADMIN;
}

