import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from 'src/shared/entities/person.entity';
import { Place } from 'src/shared/entities/place.entity';
import { Incident } from 'src/shared/entities/incident.entity';
import { Banned } from 'src/shared/entities/banned.entity';
import { BannedPlaceStatus } from 'src/shared/entities/bannedPlace.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(
    @InjectRepository(Person) private readonly personRepo: Repository<Person>,
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
    @InjectRepository(Incident) private readonly incidentRepo: Repository<Incident>,
    @InjectRepository(Banned) private readonly bannedRepo: Repository<Banned>,
  ) {}

  @Get('summary')
  async getSummary() {
    const [totalPersons, totalPlaces, totalIncidents, activeBans] = await Promise.all([
      this.personRepo.count(),
      this.placeRepo.count(),
      this.incidentRepo.count(),
      (async () => {
        const now = new Date();
        const allBans = await this.bannedRepo
          .createQueryBuilder('b')
          .leftJoinAndSelect('b.bannedPlaces', 'bp')
          .where('b.requiresApproval = :approved', { approved: false })
          .andWhere('b.startingDate <= :now', { now })
          .andWhere('b.endingDate > :now', { now })
          .getMany();
        
        // Filtrar solo los que tienen todos sus places aprobados
        return allBans.filter(ban => {
          if (!ban.bannedPlaces || ban.bannedPlaces.length === 0) return false;
          return ban.bannedPlaces.every(bp => bp.status === BannedPlaceStatus.APPROVED);
        }).length;
      })(),
    ]);

    // recientes mínimos para el primer render (id + timestamps)
    const [recentIncidents, recentBanneds] = await Promise.all([
      this.incidentRepo.find({
        take: 5,
        order: { id: 'DESC' } as any,
        select: ['id'] as any,
      }),
      this.bannedRepo.find({
        take: 5,
        order: { startingDate: 'DESC' } as any,
        select: ['id', 'startingDate'] as any,
      }),
    ]);

    return {
      totals: {
        totalPersons,
        totalPlaces,
        totalIncidents,
        activeBans,
      },
      recent: {
        incidents: recentIncidents,
        banneds: recentBanneds,
      },
    };
  }
}


