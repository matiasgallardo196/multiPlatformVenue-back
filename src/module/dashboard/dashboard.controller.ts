import { Controller, Get, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from 'src/shared/entities/person.entity';
import { Place } from 'src/shared/entities/place.entity';
import { Banned } from 'src/shared/entities/banned.entity';
import { BannedPlace, BannedPlaceStatus } from 'src/shared/entities/bannedPlace.entity';
import { User, UserRole } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { isAdmin } from '../auth/role-utils';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(
    @InjectRepository(Person) private readonly personRepo: Repository<Person>,
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
    @InjectRepository(Banned) private readonly bannedRepo: Repository<Banned>,
    @InjectRepository(BannedPlace) private readonly bannedPlaceRepo: Repository<BannedPlace>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly userService: UserService,
  ) {}

  @Roles(UserRole.STAFF)
  @Get('summary')
  async getSummary(@Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new NotFoundException('User ID not found in request');
    }

    // Optimización: solo obtener campos necesarios, no toda la relación place
    const user = await this.userService.findByIdForAuth(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // STAFF: Datos básicos + información del lugar si tiene placeId asignado
    if (user.role === UserRole.STAFF) {
      if (!user.placeId) {
        // Sin lugar asignado, solo datos básicos
        // Optimización: ejecutar queries en paralelo
        const [totalPersons, activeBans] = await Promise.all([
          this.personRepo.count(),
          this.getActiveBansCount(user),
        ]);
        
        return {
          totals: {
            totalPersons,
            activeBans,
          },
        };
      }

      // Optimización: ejecutar todas las queries en paralelo
      const [place, placeStats, contactInfo, totalPersons, activeBans] = await Promise.all([
        this.placeRepo.findOne({ 
          where: { id: user.placeId },
          select: ['id', 'name'], // Solo campos necesarios
        }),
        this.getPlaceStats(user.placeId),
        this.getContactInfoForPlace(user.placeId),
        this.personRepo.count(), // TODO: filtrar por place si es necesario
        this.getActiveBansCount(user),
      ]);

      return {
        totals: {
          totalPersons,
          activeBans,
        },
        placeId: user.placeId,
        placeName: place?.name || null,
        placeStats,
        contactInfo,
      };
    }

    // Datos base para todos los roles
    const baseStats = {
      totals: {
        totalPersons: await this.personRepo.count(),
        activeBans: await this.getActiveBansCount(user),
      },
    };

    // ADMIN: Estadísticas globales
    if (isAdmin(user.role)) {
      const [totalPlaces, totalUsers, usersByRole, pendingBans, placesStats, recentActivity] = await Promise.all([
        this.placeRepo.count(),
        this.userRepo.count(),
        this.getUsersByRole(),
        this.getPendingBansCount(),
        this.getPlacesStats(),
        this.getRecentActivity(),
      ]);

      return {
        ...baseStats,
        totals: {
          ...baseStats.totals,
          totalPlaces,
          totalUsers,
        },
        usersByRole,
        pendingBans,
        placesStats,
        recentActivity,
      };
    }

    // MANAGER o HEAD_MANAGER: Estadísticas de su lugar
    if (user.role === UserRole.HEAD_MANAGER || user.role === UserRole.MANAGER) {
      if (!user.placeId) {
        // Sin lugar asignado, solo datos básicos
        // Optimización: ejecutar queries en paralelo
        const [totalPersons, activeBans] = await Promise.all([
          this.personRepo.count(),
          this.getActiveBansCount(user),
        ]);
        return {
          totals: {
            totalPersons,
            activeBans,
          },
        };
      }

      // Optimización: ejecutar TODAS las queries en paralelo
      const [
        place,
        totalPersons,
        activeBans,
        placeStats,
        recentActivity,
        usersUnderManagement, // Solo se usa si es HEAD_MANAGER
      ] = await Promise.all([
        this.placeRepo.findOne({ 
          where: { id: user.placeId },
          select: ['id', 'name'], // Solo campos necesarios
        }),
        this.personRepo.count(),
        this.getActiveBansCount(user),
        this.getPlaceStats(user.placeId),
        this.getRecentActivity(user.placeId),
        // Para HEAD_MANAGER, obtener usuarios; para MANAGER, retornar array vacío
        user.role === UserRole.HEAD_MANAGER 
          ? this.getUsersForPlace(user.placeId)
          : Promise.resolve([]),
      ]);

      const result: any = {
        totals: {
          totalPersons,
          activeBans,
        },
        placeId: user.placeId,
        placeName: place?.name || null,
        placeStats,
        recentActivity,
      };

      // HEAD_MANAGER: incluir usuarios bajo su gestión
      if (user.role === UserRole.HEAD_MANAGER) {
        result.usersUnderManagement = usersUnderManagement;
      }

      return result;
    }

    // STAFF: Solo datos básicos (fallback)
    return baseStats;
  }

  // Métodos auxiliares
  private async getActiveBansCount(user: User): Promise<number> {
    const now = new Date();
    
    // Optimización: usar COUNT en SQL en lugar de cargar todos los registros y filtrar en memoria
    if (!isAdmin(user.role) && user.placeId) {
      // Para managers: contar directamente con las condiciones en SQL
      return await this.bannedRepo
        .createQueryBuilder('b')
        .leftJoin('b.bannedPlaces', 'bp')
        .where('b.requiresApproval = :approved', { approved: false })
        .andWhere('b.startingDate <= :now', { now })
        .andWhere('b.endingDate > :now', { now })
        .andWhere('bp.placeId = :placeId', { placeId: user.placeId })
        .andWhere('bp.status = :approvedStatus', { approvedStatus: BannedPlaceStatus.APPROVED })
        .getCount();
    }

    // Para ADMIN: contar solo los que tienen TODOS sus places aprobados
    // Estrategia: contar baneos que tienen al menos un place aprobado
    // y que no tienen ningún place pendiente o rechazado
    // Usamos LEFT JOIN para encontrar baneos sin places con status diferente a APPROVED
    const result = await this.bannedRepo
      .createQueryBuilder('b')
      .innerJoin('b.bannedPlaces', 'bp_approved', 'bp_approved.status = :approvedStatus', { approvedStatus: BannedPlaceStatus.APPROVED })
      .leftJoin('b.bannedPlaces', 'bp_other', 'bp_other.status != :approvedStatus', { approvedStatus: BannedPlaceStatus.APPROVED })
      .where('b.requiresApproval = :approved', { approved: false })
      .andWhere('b.startingDate <= :now', { now })
      .andWhere('b.endingDate > :now', { now })
      .andWhere('bp_other.bannedId IS NULL') // No tiene places con status diferente a APPROVED
      .select('COUNT(DISTINCT b.id)', 'count')
      .getRawOne();

    return parseInt(result?.count || '0', 10);
  }

  private async getActiveBansForPlace(placeId: string): Promise<number> {
    // Optimización: usar COUNT en SQL en lugar de cargar todos los registros
    const now = new Date();
    return await this.bannedRepo
      .createQueryBuilder('b')
      .leftJoin('b.bannedPlaces', 'bp')
      .where('b.requiresApproval = :approved', { approved: false })
      .andWhere('b.startingDate <= :now', { now })
      .andWhere('b.endingDate > :now', { now })
      .andWhere('bp.placeId = :placeId', { placeId })
      .andWhere('bp.status = :approvedStatus', { approvedStatus: BannedPlaceStatus.APPROVED })
      .getCount();
  }

  private async getPendingBansForPlace(placeId: string): Promise<number> {
    const pendingPlaces = await this.bannedPlaceRepo
      .createQueryBuilder('bp')
      .where('bp.placeId = :placeId', { placeId })
      .andWhere('bp.status = :pendingStatus', { pendingStatus: BannedPlaceStatus.PENDING })
      .getCount();

    return pendingPlaces;
  }

  private async getPendingBansCount(): Promise<number> {
    return this.bannedPlaceRepo.count({
      where: { status: BannedPlaceStatus.PENDING },
    });
  }

  private async getUsersForPlace(placeId: string): Promise<Array<{ id: string; userName: string; role: string; email: string | null }>> {
    const users = await this.userRepo.find({
      where: { placeId },
      select: ['id', 'userName', 'role', 'email'],
      order: { userName: 'ASC' },
    });

    return users.map(u => ({
      id: u.id,
      userName: u.userName,
      role: u.role,
      email: u.email,
    }));
  }

  private async getUsersByRole(): Promise<{ admin: number; 'head-manager': number; manager: number; staff: number }> {
    // Optimización: usar COUNT en SQL en lugar de cargar todos los usuarios
    const [admin, headManager, manager, staff] = await Promise.all([
      this.userRepo.count({ where: { role: UserRole.ADMIN } }),
      this.userRepo.count({ where: { role: UserRole.HEAD_MANAGER } }),
      this.userRepo.count({ where: { role: UserRole.MANAGER } }),
      this.userRepo.count({ where: { role: UserRole.STAFF } }),
    ]);

    return {
      admin,
      'head-manager': headManager,
      manager,
      staff,
    };
  }

  private async getPlaceStats(placeId: string): Promise<{ activeBans: number; pendingBans: number; totalPersons: number }> {
    const [activeBans, pendingBans, totalPersons] = await Promise.all([
      this.getActiveBansForPlace(placeId),
      this.getPendingBansForPlace(placeId),
      this.getPersonsForPlace(placeId),
    ]);

    return {
      activeBans,
      pendingBans,
      totalPersons,
    };
  }

  private async getPersonsForPlace(placeId: string): Promise<number> {
    // Contar personas únicas que tienen baneos activos o pendientes en este lugar
    const now = new Date();
    
    // Obtener IDs de personas con baneos activos en este lugar
    const activeBans = await this.bannedRepo
      .createQueryBuilder('b')
      .leftJoin('b.bannedPlaces', 'bp')
      .leftJoin('b.person', 'p')
      .where('bp.placeId = :placeId', { placeId })
      .andWhere('bp.status = :approvedStatus', { approvedStatus: BannedPlaceStatus.APPROVED })
      .andWhere('b.requiresApproval = :approved', { approved: false })
      .andWhere('b.startingDate <= :now', { now })
      .andWhere('(b.endingDate > :now OR b.endingDate IS NULL)', { now })
      .select('DISTINCT p.id', 'personId')
      .getRawMany();

    // Obtener IDs de personas con baneos pendientes en este lugar
    const pendingBans = await this.bannedRepo
      .createQueryBuilder('b')
      .leftJoin('b.bannedPlaces', 'bp')
      .leftJoin('b.person', 'p')
      .where('bp.placeId = :placeId', { placeId })
      .andWhere('bp.status = :pendingStatus', { pendingStatus: BannedPlaceStatus.PENDING })
      .select('DISTINCT p.id', 'personId')
      .getRawMany();

    // Combinar y contar únicos
    const allPersonIds = new Set([
      ...activeBans.map(b => b.personId).filter(Boolean),
      ...pendingBans.map(b => b.personId).filter(Boolean),
    ]);

    return allPersonIds.size;
  }

  private async getPlacesStats(): Promise<Array<{ placeId: string; placeName: string; activeBans: number; pendingBans: number; totalPersons: number }>> {
    const places = await this.placeRepo.find({
      order: { name: 'ASC' },
    });

    const statsPromises = places.map(async (place) => {
      const placeStats = await this.getPlaceStats(place.id);
      return {
        placeId: place.id,
        placeName: place.name,
        ...placeStats,
      };
    });

    return Promise.all(statsPromises);
  }

  private async getRecentActivity(placeId?: string): Promise<Array<{ id: string; startingDate: Date; type: string }>> {
    const qb = this.bannedRepo
      .createQueryBuilder('b')
      .select(['b.id', 'b.startingDate'])
      .orderBy('b.startingDate', 'DESC')
      .take(10);

    if (placeId) {
      qb.leftJoin('b.bannedPlaces', 'bp')
        .where('bp.placeId = :placeId', { placeId });
    }

    const recentBanneds = await qb.getMany();

    return recentBanneds.map(b => ({
      id: b.id,
      startingDate: b.startingDate,
      type: 'ban',
    }));
  }

  private async getContactInfoForPlace(placeId: string): Promise<{
    manager: { userName: string; email: string | null } | null;
    headManager: { userName: string; email: string | null } | null;
  }> {
    const [manager, headManager] = await Promise.all([
      this.userRepo.findOne({
        where: { placeId, role: UserRole.MANAGER },
        select: ['userName', 'email'],
      }),
      this.userRepo.findOne({
        where: { placeId, role: UserRole.HEAD_MANAGER },
        select: ['userName', 'email'],
      }),
    ]);

    return {
      manager: manager ? { userName: manager.userName, email: manager.email } : null,
      headManager: headManager ? { userName: headManager.userName, email: headManager.email } : null,
    };
  }
}


