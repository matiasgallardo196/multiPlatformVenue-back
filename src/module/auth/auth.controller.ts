import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Public } from './public.decorator';
import { NODE_ENV } from '../../config/env.loader';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
  ) {}

  @Public()
  @Post('login')
  async login(
    @Body() body: { userName: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body.userName, body.password);
    // Set HttpOnly cookie
    const isProd = NODE_ENV === 'production';
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      sameSite: isProd ? ('none' as any) : ('lax' as any),
      secure: isProd,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });
    return { user: result.user };
  }

  @Public()
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('accessToken', '', {
      httpOnly: true,
      sameSite: isProd ? ('none' as any) : ('lax' as any),
      secure: isProd,
      path: '/',
      maxAge: 0,
    });
    return { ok: true };
  }

  @Public()
  @Get('me')
  async me(@Req() req: any) {
    const token: string | undefined = req.cookies?.['accessToken'];
    if (!token) throw new UnauthorizedException();
    try {
      const payload: any = await this.jwt.verifyAsync(token);
      return {
        userId: payload.sub,
        userName: payload.userName,
        role: payload.role,
      };
    } catch (e) {
      throw new UnauthorizedException();
    }
  }
}
