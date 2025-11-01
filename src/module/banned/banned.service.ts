import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { Banned } from 'src/shared/entities/banned.entity';
import { Person } from 'src/shared/entities/person.entity';
import { BannedPlace } from 'src/shared/entities/bannedPlace.entity';
import { Place } from 'src/shared/entities/place.entity';
import { CreateBannedDto } from './dto/create-banned.dto';
import { UpdateBannedDto } from './dto/update-banned.dto';

@Injectable()
export class BannedService {
  constructor(
    @InjectRepository(Banned)
    private readonly bannedRepository: Repository<Banned>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
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
    const person = await this.personRepository.findOne({
      where: { id: data.personId },
    });
    if (!person) throw new NotFoundException('Person not found');

    const payload: Partial<Banned> = {
      startingDate: new Date(data.startingDate as any),
      motive: data.motive,
      person,
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
      relations: ['person', 'bannedPlaces'],
    });
    return list;
  }

  async findOne(id: string): Promise<Banned> {
    const banned = await this.bannedRepository.findOne({
      where: { id },
      relations: ['person', 'bannedPlaces'],
    });
    if (!banned) throw new NotFoundException('Ban not found');
    return banned;
  }

  async update(id: string, data: UpdateBannedDto): Promise<Banned> {
    const banned = await this.bannedRepository.findOne({ where: { id } });
    if (!banned) throw new NotFoundException('Ban not found');
    Object.assign(banned, data);
    banned.howlong = this.computeHowLong(
      banned.startingDate,
      banned.endingDate,
    );
    const saved = await this.bannedRepository.save(banned);
    return saved;
  }

  async remove(id: string): Promise<void> {
    // Load with relations to ensure existence and provide clear message
    const banned = await this.bannedRepository.findOne({
      where: { id },
      relations: ['bannedPlaces', 'person'],
    });
    if (!banned) throw new NotFoundException('Ban not found');

    // With onDelete: 'CASCADE' on BannedPlace.banned, we can allow delete and related bannedPlaces will be removed

    const result = await this.bannedRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Ban not found');
  }

  async findByPerson(personId: string): Promise<Banned[]> {
    const list = await this.bannedRepository.find({
      where: { person: { id: personId } },
      relations: ['person', 'bannedPlaces'],
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
          person: { id: personId },
          startingDate: LessThanOrEqual(now),
          endingDate: IsNull(),
        },
        {
          person: { id: personId },
          startingDate: LessThanOrEqual(now),
          endingDate: MoreThanOrEqual(now),
        },
      ],
    });
    return { personId, isBanned: activeCount > 0, activeCount };
  }
}
