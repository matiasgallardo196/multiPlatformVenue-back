import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FRONTEND_URL } from '../../config/env.loader';
import { UserRole } from './user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly users: UserService) {}

  // Listar todos los usuarios (head-manager y admin)
  @Get()
  @Roles(UserRole.HEAD_MANAGER)
  async findAll(@Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.users.findAll(userId);
  }

  // Invitar usuario por email (head-manager y admin)
  @Post('invite')
  @Roles(UserRole.HEAD_MANAGER)
  async inviteUser(@Body() dto: InviteUserDto, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    const redirectUrl = `${FRONTEND_URL}/auth/callback?next=/auth/set-password`;
    return this.users.inviteUserByEmail(
      dto.email,
      dto.userName,
      dto.role,
      redirectUrl,
      userId,
      dto.placeId,
    );
  }

  // Crear usuario con contraseña (head-manager y admin)
  @Post()
  @Roles(UserRole.HEAD_MANAGER)
  async createUser(@Body() dto: CreateUserDto, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.users.createUserWithPassword(
      dto.email,
      dto.userName,
      dto.password,
      dto.role,
      userId,
      dto.placeId,
    );
  }

  // Eliminar usuario (head-manager y admin)
  @Delete(':id')
  @Roles(UserRole.HEAD_MANAGER)
  async deleteUser(@Param('id') id: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.users.deleteUser(id, userId);
  }
}
