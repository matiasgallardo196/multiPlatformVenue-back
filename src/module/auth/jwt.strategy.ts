import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_SECRET } from 'src/config/env.loader';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const cookieExtractor = (req: any) => {
      if (req && req.cookies) {
        return req.cookies['accessToken'] || null;
      }
      return null;
    };
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      userName: payload.userName,
      role: payload.role,
    };
  }
}
