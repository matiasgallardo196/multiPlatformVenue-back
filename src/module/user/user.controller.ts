import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { UserService } from './user.service';
import * as bcrypt from 'bcryptjs';
import { BCRYPT_SALT_ROUNDS } from 'src/config/env.loader';

@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Public()
  @Post('seed-admin')
  async seedAdmin(
    @Body() body: { userName: string; password: string; role?: string },
  ) {
    const hash = await bcrypt.hash(body.password, BCRYPT_SALT_ROUNDS);
    const user = await this.users.create(
      body.userName,
      hash,
      body.role || 'admin',
    );
    return { id: user.id, userName: user.userName, role: user.role };
  }
}
