import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { Place } from '../../shared/entities/place.entity';
import { supabaseAdmin } from '../../config/supabase';
import { hasRoleOrAbove, isAdmin } from '../auth/role-utils';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
  ) {}

  findByUserName(userName: string) {
    return this.repo.findOne({ where: { userName } });
  }

  findById(id: string) {
    return this.repo.findOne({ 
      where: { id },
      relations: ['place'],
    });
  }

  // Optimización: obtener solo campos necesarios para validación de permisos
  findByIdForAuth(id: string) {
    return this.repo.findOne({ 
      where: { id },
      select: ['id', 'role', 'placeId'], // Solo campos necesarios, sin cargar relación place
    });
  }

  findBySupabaseId(supabaseUserId: string) {
    return this.repo.findOne({ where: { supabaseUserId } });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findPlaceById(placeId: string) {
    return this.placeRepo.findOne({ 
      where: { id: placeId },
      select: ['id', 'city'], // Solo seleccionar campos necesarios
    });
  }

  async create(userName: string, passwordHash: string, role: UserRole | string) {
    const userRole =
      typeof role === 'string'
        ? (Object.values(UserRole).find((r) => r === role) as UserRole) ||
          UserRole.STAFF
        : role;

    const user = this.repo.create({
      userName,
      passwordHash,
      role: userRole,
    });
    return this.repo.save(user);
  }

  async createOrUpdateFromSupabase(
    supabaseUserId: string,
    email: string,
    userName: string,
    role: UserRole | string,
  ) {
    // Convertir string a enum si es necesario
    const userRole =
      typeof role === 'string'
        ? (Object.values(UserRole).find((r) => r === role) as UserRole) ||
          UserRole.STAFF
        : role;

    // Optimización: usar findOne con select específico para evitar cargar toda la entidad
    let user = await this.repo.findOne({ 
      where: { supabaseUserId },
      select: ['id', 'supabaseUserId', 'email', 'userName', 'role', 'placeId'], // Solo campos necesarios
    });

    if (user) {
      // Solo actualizar si realmente cambió algo
      const needsUpdate = user.email !== email || user.userName !== userName;
      if (needsUpdate) {
        user.email = email;
        user.userName = userName;
        return this.repo.save(user);
      }
      return user; // No necesita actualización, evitar save innecesario
    }

    // Buscar por email o userName en una sola query usando OR
    user = await this.repo.findOne({
      where: [
        { email },
        { userName },
      ],
      select: ['id', 'supabaseUserId', 'email', 'userName', 'role', 'placeId'],
    });

    if (user) {
      // Vincular usuario existente con Supabase
      user.supabaseUserId = supabaseUserId;
      user.email = email;
      return this.repo.save(user);
    }

    // Crear nuevo usuario
    user = this.repo.create({
      supabaseUserId,
      email,
      userName,
      role: userRole,
    });

    return this.repo.save(user);
  }

  // Método para listar todos los usuarios
  // ADMIN: ve todos los usuarios
  // HEAD_MANAGER: ve solo usuarios de su place
  async findAll(creatorUserId: string) {
    // Optimización: solo obtener rol y placeId, no toda la relación place
    const creator = await this.findByIdForAuth(creatorUserId);
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    // ADMIN puede ver todos los usuarios
    if (isAdmin(creator.role)) {
      return this.repo.find({
        select: ['id', 'userName', 'email', 'role', 'supabaseUserId', 'placeId'],
        order: { userName: 'ASC' },
      });
    }

    // HEAD_MANAGER solo ve usuarios de su place
    if (!creator.placeId) {
      throw new ConflictException('Head manager must have a place assigned');
    }

    return this.repo.find({
      where: { placeId: creator.placeId },
      select: ['id', 'userName', 'email', 'role', 'supabaseUserId', 'placeId'],
      order: { userName: 'ASC' },
    });
  }

  // Método para invitar usuario por email (Supabase envía el email)
  async inviteUserByEmail(
    email: string,
    userName: string,
    role: UserRole | string,
    redirectUrl: string,
    creatorUserId: string,
    placeId?: string,
  ) {
    // Convertir string a enum si es necesario
    const userRole =
      typeof role === 'string'
        ? (Object.values(UserRole).find((r) => r === role) as UserRole) ||
          UserRole.STAFF
        : role;

    // Obtener el creador y validar permisos
    const creator = await this.findById(creatorUserId);
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    // Validar política de creación de roles y determinar placeId
    let userPlaceId: string | null;

    if (isAdmin(creator.role)) {
      // ADMIN puede crear cualquier rol, debe especificar placeId en el DTO
      if (!placeId) {
        throw new ConflictException('Admin must specify a placeId when creating users');
      }
      // Validar que el placeId existe
      const place = await this.placeRepo.findOne({ where: { id: placeId } });
      if (!place) {
        throw new NotFoundException('Place not found');
      }
      userPlaceId = placeId;
    } else if (creator.role === UserRole.HEAD_MANAGER) {
      // HEAD_MANAGER solo puede crear MANAGER o STAFF
      if (userRole !== UserRole.MANAGER && userRole !== UserRole.STAFF) {
        throw new ConflictException('Head-manager can only create manager or staff roles');
      }
      if (!creator.placeId) {
        throw new ConflictException('Head manager must have a place assigned');
      }
      // HEAD_MANAGER usa su propio placeId (ignora el parámetro si se proporciona)
      userPlaceId = creator.placeId;
    } else {
      throw new ConflictException('Only admin or head-manager can create users');
    }

    const roleString = userRole as string; // Los valores del enum son strings

    console.log('[UserService] Iniciando invitación de usuario:', {
      email,
      userName,
      role: roleString,
      redirectUrl,
      placeId: userPlaceId,
      creatorRole: creator.role,
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
          role: roleString,
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

    // Crear usuario en la base de datos con placeId del creador
    const user = this.repo.create({
      email,
      userName,
      role: userRole,
      supabaseUserId: data.user?.id,
      placeId: userPlaceId,
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
    role: UserRole | string,
    creatorUserId: string,
    placeId?: string,
  ) {
    // Convertir string a enum si es necesario
    const userRole =
      typeof role === 'string'
        ? (Object.values(UserRole).find((r) => r === role) as UserRole) ||
          UserRole.STAFF
        : role;

    // Obtener el creador y validar permisos
    const creator = await this.findById(creatorUserId);
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    // Validar política de creación de roles y determinar placeId
    let userPlaceId: string | null;

    if (isAdmin(creator.role)) {
      // ADMIN puede crear cualquier rol, debe especificar placeId en el DTO
      if (!placeId) {
        throw new ConflictException('Admin must specify a placeId when creating users');
      }
      // Validar que el placeId existe
      const place = await this.placeRepo.findOne({ where: { id: placeId } });
      if (!place) {
        throw new NotFoundException('Place not found');
      }
      userPlaceId = placeId;
    } else if (creator.role === UserRole.HEAD_MANAGER) {
      // HEAD_MANAGER solo puede crear MANAGER o STAFF
      if (userRole !== UserRole.MANAGER && userRole !== UserRole.STAFF) {
        throw new ConflictException('Head-manager can only create manager or staff roles');
      }
      if (!creator.placeId) {
        throw new ConflictException('Head manager must have a place assigned');
      }
      // HEAD_MANAGER usa su propio placeId (ignora el parámetro si se proporciona)
      userPlaceId = creator.placeId;
    } else {
      throw new ConflictException('Only admin or head-manager can create users');
    }

    const roleString = userRole as string; // Los valores del enum son strings

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
        role: roleString,
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
      role: userRole,
      supabaseUserId: data.user?.id,
      placeId: userPlaceId,
    });

    return this.repo.save(user);
  }

  // Método para eliminar usuario
  // ADMIN: puede eliminar cualquier usuario
  // HEAD_MANAGER: solo puede eliminar usuarios de su place
  async deleteUser(id: string, creatorUserId: string) {
    const userToDelete = await this.findById(id);
    if (!userToDelete) {
      throw new NotFoundException('User not found');
    }

    const creator = await this.findById(creatorUserId);
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    // ADMIN puede eliminar cualquier usuario
    if (!isAdmin(creator.role)) {
      // HEAD_MANAGER solo puede eliminar usuarios de su place
      if (!creator.placeId) {
        throw new ConflictException('Head manager must have a place assigned');
      }
      if (userToDelete.placeId !== creator.placeId) {
        throw new ConflictException('User does not belong to head manager place');
      }
    }

    // Eliminar de Supabase si tiene supabaseUserId
    if (userToDelete.supabaseUserId && supabaseAdmin) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(userToDelete.supabaseUserId);
      } catch (error) {
        console.error('[UserService] Error deleting from Supabase:', error);
      }
    }

    // Eliminar de la base de datos
    await this.repo.remove(userToDelete);
    return { message: 'User deleted successfully' };
  }
}
