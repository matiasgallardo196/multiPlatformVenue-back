import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Endpoint público para obtener información del usuario autenticado
   * Valida el token de Supabase desde el header Authorization
   */
  @Public()
  @Get('me')
  async me(@Req() req: any) {
    // Obtener token del header Authorization
    const authHeader = req.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('No token provided');

    return await this.auth.validateToken(token);
  }
}
