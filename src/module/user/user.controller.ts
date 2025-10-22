import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FRONTEND_URL } from '../../config/env.loader';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly users: UserService) {}

  // Listar todos los usuarios (solo head-manager)
  @Get()
  @Roles('head-manager')
  async findAll() {
    return this.users.findAll();
  }

  // Invitar usuario por email (solo head-manager)
  @Post('invite')
  @Roles('head-manager')
  async inviteUser(@Body() dto: InviteUserDto) {
    const redirectUrl = `${FRONTEND_URL}/auth/callback?next=/auth/set-password`;
    return this.users.inviteUserByEmail(
      dto.email,
      dto.userName,
      dto.role,
      redirectUrl,
    );
  }

  // Crear usuario con contraseña (solo head-manager)
  @Post()
  @Roles('head-manager')
  async createUser(@Body() dto: CreateUserDto) {
    return this.users.createUserWithPassword(
      dto.email,
      dto.userName,
      dto.password,
      dto.role,
    );
  }

  // Eliminar usuario (solo head-manager)
  @Delete(':id')
  @Roles('head-manager')
  async deleteUser(@Param('id') id: string) {
    return this.users.deleteUser(id);
  }
}
