import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
      console.error(
        '[AuthService] Supabase client not configured. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.',
      );
      throw new ServiceUnavailableException(
        'Authentication service is not configured',
      );
    }

    try {
      const {
        data: { user: supabaseUser },
        error,
      } = await supabaseClient.auth.getUser(token);

      if (error || !supabaseUser) {
        // Si es un error de red (502, 503, etc.), lanzar ServiceUnavailableException
        if (
          error &&
          (error.status === 502 || error.status === 503 || error.status === 504)
        ) {
          console.error('[AuthService] Supabase service unavailable:', error);
          throw new ServiceUnavailableException(
            'Authentication service is temporarily unavailable',
          );
        }

        console.error('[AuthService] Invalid token:', error);
        throw new UnauthorizedException('Invalid token');
      }

      // Obtener o crear el usuario en la base de datos
      const userName =
        supabaseUser.user_metadata?.userName ||
        supabaseUser.email?.split('@')[0] ||
        '';
      const role = supabaseUser.user_metadata?.role || UserRole.STAFF;

      const dbUser = await this.userService.createOrUpdateFromSupabase(
        supabaseUser.id,
        supabaseUser.email || '',
        userName,
        role,
      );

      // Optimización: solo obtener place si el usuario tiene placeId
      // Evitar findById innecesario cuando el usuario ya existe y no tiene placeId
      let placeCity: string | null = null;
      if (dbUser.placeId) {
        // Solo obtener el city del place, no toda la relación
        const place = await this.userService.findPlaceById(dbUser.placeId);
        placeCity = place?.city || null;
      }

      return {
        userId: dbUser.id, // ID de la base de datos
        supabaseUserId: dbUser.supabaseUserId, // ID de Supabase
        userName: dbUser.userName,
        email: dbUser.email || '',
        role: dbUser.role,
        placeId: dbUser.placeId || null,
        city: placeCity,
      };
    } catch (error) {
      // Si ya es una excepción de NestJS, relanzarla
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      // Si es un error de Supabase con código 502, 503, 504
      if (
        error?.status === 502 ||
        error?.status === 503 ||
        error?.status === 504
      ) {
        console.error('[AuthService] Supabase service unavailable:', error);
        throw new ServiceUnavailableException(
          'Authentication service is temporarily unavailable',
        );
      }

      // Si es un error de red (no hay respuesta de Supabase)
      if (
        error?.code === 'ECONNREFUSED' ||
        error?.code === 'ETIMEDOUT' ||
        error?.message?.includes('fetch')
      ) {
        console.error(
          '[AuthService] Network error connecting to Supabase:',
          error,
        );
        throw new ServiceUnavailableException(
          'Unable to connect to authentication service',
        );
      }

      console.error('[AuthService] Error validating token:', error);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
