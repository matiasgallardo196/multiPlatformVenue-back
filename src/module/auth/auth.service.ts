import { Injectable, UnauthorizedException } from '@nestjs/common';
import { supabaseClient } from '../../config/supabase';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/user.entity';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

  /**
   * Valida un token de Supabase y retorna la información del usuario
   * vinculado con la tabla users de la base de datos
   */
  async validateToken(token: string) {
    if (!token) {
      console.error('[AuthService] No token provided');
      throw new UnauthorizedException('No token provided');
    }

    if (!supabaseClient) {
      console.error('[AuthService] Supabase client not configured');
    }

    try {
      const {
        data: { user: supabaseUser },
        error,
      } = await supabaseClient!.auth.getUser(token);

      if (error || !supabaseUser) {
        console.error('[AuthService] Invalid token:', error);
        throw new UnauthorizedException('Invalid token');
      }

      // Obtener o crear el usuario en la base de datos
      const userName =
        supabaseUser.user_metadata?.userName ||
        supabaseUser.email?.split('@')[0] ||
        '';
      const role =
        supabaseUser.user_metadata?.role || UserRole.STAFF;

      const dbUser = await this.userService.createOrUpdateFromSupabase(
        supabaseUser.id,
        supabaseUser.email || '',
        userName,
        role,
      );

      // Obtener usuario completo con relación place
      const userWithPlace = await this.userService.findById(dbUser.id);

      return {
        userId: dbUser.id, // ID de la base de datos
        supabaseUserId: dbUser.supabaseUserId, // ID de Supabase
        userName: dbUser.userName,
        email: dbUser.email || '',
        role: dbUser.role,
        placeId: userWithPlace?.placeId || null,
        city: userWithPlace?.place?.city || null,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      console.error('[AuthService] Error validating token:', error);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
