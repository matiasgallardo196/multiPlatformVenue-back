import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { AuthService } from './auth.service';

/**
 * Estrategia personalizada para validar tokens de Supabase
 * y vincular con la tabla users de la base de datos
 */
@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(req: any): Promise<any> {
    // Extraer token del header Authorization
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Usar AuthService para validar y vincular con la BD
    return await this.authService.validateToken(token);
  }
}
