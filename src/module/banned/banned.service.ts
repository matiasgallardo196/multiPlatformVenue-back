import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { Banned } from 'src/shared/entities/banned.entity';
import { Incident } from 'src/shared/entities/incident.entity';
import { BannedPlace } from 'src/shared/entities/bannedPlace.entity';
import { Place } from 'src/shared/entities/place.entity';
import { CreateBannedDto } from './dto/create-banned.dto';
import { UpdateBannedDto } from './dto/update-banned.dto';

@Injectable()
export class BannedService {
  constructor(
    @InjectRepository(Banned)
    private readonly bannedRepository: Repository<Banned>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(BannedPlace)
    private readonly bannedPlaceRepository: Repository<BannedPlace>,
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
  ) {}

  // isActive se expone desde la entidad con @Expose, no se persiste

  private computeHowLong(
    start?: Date | null,
    end?: Date | null,
  ): { years: string; months: string; days: string } | null {
    if (!start || !end) return null;
    const s = new Date(start);
    const e = new Date(end);
    if (e < s) return { years: '0', months: '0', days: '0' };

    let years = e.getFullYear() - s.getFullYear();
    let months = e.getMonth() - s.getMonth();
    let days = e.getDate() - s.getDate();

    if (days < 0) {
      // Tomar días del mes anterior
      const prevMonth = new Date(e.getFullYear(), e.getMonth(), 0);
      days += prevMonth.getDate();
      months -= 1;
    }
    if (months < 0) {
      months += 12;
      years -= 1;
    }
    return { years: String(years), months: String(months), days: String(days) };
  }

  async create(data: CreateBannedDto): Promise<Banned> {
    const incident = await this.incidentRepository.findOne({
      where: { id: data.incidentId },
      relations: ['person'],
    });
    if (!incident) throw new NotFoundException('Incidente no encontrado');

    const payload: Partial<Banned> = {
      startingDate: new Date(data.startingDate as any),
      motive: data.motive,
      incident,
      endingDate: new Date(data.endingDate as any),
    };
    payload.howlong = this.computeHowLong(
      payload.startingDate,
      payload.endingDate ?? null,
    );
    const banned = this.bannedRepository.create(payload);
    const saved = await this.bannedRepository.save(banned);

    if (data.placeIds && data.placeIds.length > 0) {
      const places = await this.placeRepository.find({
        where: { id: In(data.placeIds) },
      });
      if (places.length !== data.placeIds.length) {
        throw new NotFoundException('Alguno de los lugares no existe');
      }
      const links = places.map((place) =>
        this.bannedPlaceRepository.create({
          bannedId: saved.id,
          placeId: place.id,
          banned: saved,
          place,
        }),
      );
      await this.bannedPlaceRepository.save(links);
    }
    return saved;
  }

  async findAll(): Promise<Banned[]> {
    const list = await this.bannedRepository.find({
      relations: [
        'incident',
        'incident.person',
        'incident.place',
        'bannedPlaces',
      ],
    });
    return list;
  }

  async findOne(id: string): Promise<Banned> {
    const banned = await this.bannedRepository.findOne({
      where: { id },
      relations: [
        'incident',
        'incident.person',
        'incident.place',
        'bannedPlaces',
      ],
    });
    if (!banned) throw new NotFoundException('Baneo no encontrado');
    return banned;
  }

  async update(id: string, data: UpdateBannedDto): Promise<Banned> {
    const banned = await this.bannedRepository.findOne({ where: { id } });
    if (!banned) throw new NotFoundException('Baneo no encontrado');
    Object.assign(banned, data);
    banned.howlong = this.computeHowLong(
      banned.startingDate,
      banned.endingDate,
    );
    const saved = await this.bannedRepository.save(banned);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const result = await this.bannedRepository.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Baneo no encontrado');
  }

  async findByPerson(personId: string): Promise<Banned[]> {
    const list = await this.bannedRepository.find({
      where: { incident: { person: { id: personId } } },
      relations: [
        'incident',
        'incident.person',
        'incident.place',
        'bannedPlaces',
      ],
      order: { startingDate: 'DESC' },
    });
    return list;
  }

  async isPersonBanned(
    personId: string,
  ): Promise<{ personId: string; isBanned: boolean; activeCount: number }> {
    const now = new Date();
    const activeCount = await this.bannedRepository.count({
      where: [
        {
          incident: { person: { id: personId } },
          startingDate: LessThanOrEqual(now),
          endingDate: IsNull(),
        },
        {
          incident: { person: { id: personId } },
          startingDate: LessThanOrEqual(now),
          endingDate: MoreThanOrEqual(now),
        },
      ],
      relations: ['incident', 'incident.person'],
    });
    return { personId, isBanned: activeCount > 0, activeCount };
  }
}
