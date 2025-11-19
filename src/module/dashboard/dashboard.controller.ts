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

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
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
        return baseStats;
      }

      const place = await this.placeRepo.findOne({ where: { id: user.placeId } });
      const [placeStats, recentActivity] = await Promise.all([
        this.getPlaceStats(user.placeId),
        this.getRecentActivity(user.placeId),
      ]);

      const result: any = {
        ...baseStats,
        placeId: user.placeId,
        placeName: place?.name || null,
        placeStats,
        recentActivity,
      };

      // HEAD_MANAGER: Además incluir usuarios bajo su gestión
      if (user.role === UserRole.HEAD_MANAGER) {
        result.usersUnderManagement = await this.getUsersForPlace(user.placeId);
      }

      return result;
    }

    // STAFF: Solo datos básicos
    return baseStats;
  }

  // Métodos auxiliares
  private async getActiveBansCount(user: User): Promise<number> {
    const now = new Date();
    const qb = this.bannedRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.bannedPlaces', 'bp')
      .where('b.requiresApproval = :approved', { approved: false })
      .andWhere('b.startingDate <= :now', { now })
      .andWhere('b.endingDate > :now', { now });

    // Si no es ADMIN y tiene lugar, filtrar por lugar
    if (!isAdmin(user.role) && user.placeId) {
      qb.andWhere('bp.placeId = :placeId', { placeId: user.placeId })
        .andWhere('bp.status = :approvedStatus', { approvedStatus: BannedPlaceStatus.APPROVED });
    }

    const allBans = await qb.getMany();

    // Filtrar solo los que tienen todos sus places aprobados
    return allBans.filter(ban => {
      if (!ban.bannedPlaces || ban.bannedPlaces.length === 0) return false;
      if (isAdmin(user.role)) {
        return ban.bannedPlaces.every(bp => bp.status === BannedPlaceStatus.APPROVED);
      }
      // Para managers, solo contar si tiene el lugar aprobado
      return ban.bannedPlaces.some(bp => bp.placeId === user.placeId && bp.status === BannedPlaceStatus.APPROVED);
    }).length;
  }

  private async getActiveBansForPlace(placeId: string): Promise<number> {
    const now = new Date();
    const allBans = await this.bannedRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.bannedPlaces', 'bp')
      .where('b.requiresApproval = :approved', { approved: false })
      .andWhere('b.startingDate <= :now', { now })
      .andWhere('b.endingDate > :now', { now })
      .andWhere('bp.placeId = :placeId', { placeId })
      .andWhere('bp.status = :approvedStatus', { approvedStatus: BannedPlaceStatus.APPROVED })
      .getMany();

    return allBans.length;
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
    const users = await this.userRepo.find({
      select: ['role'],
    });

    return {
      admin: users.filter(u => u.role === UserRole.ADMIN).length,
      'head-manager': users.filter(u => u.role === UserRole.HEAD_MANAGER).length,
      manager: users.filter(u => u.role === UserRole.MANAGER).length,
      staff: users.filter(u => u.role === UserRole.STAFF).length,
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
}


