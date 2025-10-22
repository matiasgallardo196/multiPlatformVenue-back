import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { supabaseAdmin } from '../../config/supabase';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findByUserName(userName: string) {
    return this.repo.findOne({ where: { userName } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findBySupabaseId(supabaseUserId: string) {
    return this.repo.findOne({ where: { supabaseUserId } });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async create(userName: string, passwordHash: string, role: string) {
    const user = this.repo.create({
      userName,
      passwordHash,
      role: role as any,
    });
    return this.repo.save(user);
  }

  async createOrUpdateFromSupabase(
    supabaseUserId: string,
    email: string,
    userName: string,
    role: string,
  ) {
    // Buscar si ya existe un usuario con este supabaseUserId
    let user = await this.findBySupabaseId(supabaseUserId);

    if (user) {
      // Actualizar usuario existente (NO actualizar el rol, se gestiona desde PostgreSQL)
      user.email = email;
      user.userName = userName;
      // NO actualizar user.role - el rol se gestiona desde la base de datos
    } else {
      // Intentar vincular con un usuario existente por email o userName
      user = await this.findByEmail(email);
      if (!user) {
        user = await this.findByUserName(userName);
      }

      if (user) {
        // Vincular usuario existente con Supabase
        user.supabaseUserId = supabaseUserId;
        user.email = email;
      } else {
        // Crear nuevo usuario
        user = this.repo.create({
          supabaseUserId,
          email,
          userName,
          role: role as any,
        });
      }
    }

    return this.repo.save(user);
  }

  // Método para listar todos los usuarios
  async findAll() {
    return this.repo.find({
      select: ['id', 'userName', 'email', 'role', 'supabaseUserId'],
      order: { userName: 'ASC' },
    });
  }

  // Método para invitar usuario por email (Supabase envía el email)
  async inviteUserByEmail(
    email: string,
    userName: string,
    role: string,
    redirectUrl: string,
  ) {
    console.log('[UserService] Iniciando invitación de usuario:', {
      email,
      userName,
      role,
      redirectUrl,
    });

    if (!supabaseAdmin) {
      console.error('[UserService] Supabase admin client not configured');
      throw new Error('Supabase admin client not configured');
    }

    // Verificar si el usuario ya existe
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      console.warn('[UserService] Usuario ya existe:', email);
      throw new ConflictException('User with this email already exists');
    }

    console.log('[UserService] Llamando a Supabase inviteUserByEmail...');

    // Crear usuario en Supabase (envía invitación automáticamente)
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          userName,
          role,
        },
        redirectTo: redirectUrl,
      },
    );

    if (error) {
      console.error('[UserService] Error de Supabase:', {
        message: error.message,
        status: error.status,
        name: error.name,
        fullError: error,
      });
      throw new Error(`Failed to invite user: ${error.message}`);
    }

    console.log('[UserService] Usuario invitado exitosamente en Supabase:', {
      userId: data.user?.id,
      email: data.user?.email,
    });

    // Crear usuario en la base de datos
    const user = this.repo.create({
      email,
      userName,
      role: role as any,
      supabaseUserId: data.user?.id,
    });

    const savedUser = await this.repo.save(user);
    console.log('[UserService] Usuario guardado en BD:', savedUser.id);

    return savedUser;
  }

  // Método para crear usuario con contraseña
  async createUserWithPassword(
    email: string,
    userName: string,
    password: string,
    role: string,
  ) {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    // Verificar si el usuario ya existe
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Crear usuario en Supabase
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar el email
      user_metadata: {
        userName,
        role,
      },
    });

    if (error) {
      console.error('[UserService] Error creating user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }

    // Crear usuario en la base de datos
    const user = this.repo.create({
      email,
      userName,
      role: role as any,
      supabaseUserId: data.user?.id,
    });

    return this.repo.save(user);
  }

  // Método para eliminar usuario
  async deleteUser(id: string) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Eliminar de Supabase si tiene supabaseUserId
    if (user.supabaseUserId && supabaseAdmin) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(user.supabaseUserId);
      } catch (error) {
        console.error('[UserService] Error deleting from Supabase:', error);
      }
    }

    // Eliminar de la base de datos
    await this.repo.remove(user);
    return { message: 'User deleted successfully' };
  }
}
