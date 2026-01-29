import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Person } from 'src/shared/entities/person.entity';
import { Banned } from 'src/shared/entities/banned.entity';
import { PersonPlaceAccess, PersonAccessType } from 'src/shared/entities/personPlaceAccess.entity';
import { PlaceSettings } from 'src/shared/entities/placeSettings.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { UserService } from '../user/user.service';
import { isAdmin } from '../auth/role-utils';

@Injectable()
export class PersonService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Banned)
    private readonly bannedRepository: Repository<Banned>,
    @InjectRepository(PersonPlaceAccess)
    private readonly accessRepository: Repository<PersonPlaceAccess>,
    @InjectRepository(PlaceSettings)
    private readonly settingsRepository: Repository<PlaceSettings>,
    private readonly userService: UserService,
  ) {}

  private toTitleCase(value?: string | null): string | undefined {
    if (!value) return undefined;
    const lower = value.toLowerCase();
    return lower
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private normalizeNames<T extends { name?: string; lastName?: string; nickname?: string }>(
    data: T,
  ): T {
    return {
      ...data,
      name: this.toTitleCase(data.name) ?? data.name,
      lastName: this.toTitleCase(data.lastName) ?? data.lastName,
      nickname: this.toTitleCase(data.nickname) ?? data.nickname,
    };
  }

  private getInitials(name?: string, lastName?: string, nickname?: string): string | null {
    const n = (name || '').trim();
    const l = (lastName || '').trim();
    if (n || l) {
      const first = n.split(/\s+/)[0] || '';
      const last = l.split(/\s+/)[0] || '';
      const i1 = first.charAt(0).toUpperCase();
      const i2 = last.charAt(0).toUpperCase();
      const seed = `${i1}${i2}`.trim();
      return seed.length > 0 ? seed : null;
    }
    const nick = (nickname || '').trim();
    if (nick) {
      const parts = nick.split(/\s+/);
      const i1 = parts[0]?.charAt(0).toUpperCase() || '';
      const i2 = parts[1]?.charAt(0).toUpperCase() || '';
      const seed = `${i1}${i2}`.trim();
      return seed.length > 0 ? seed : null;
    }
    return null;
  }

  private generateDiceBearUrl(seed: string, gender?: 'Male' | 'Female'): string {
    const safeSeed = encodeURIComponent(seed);
    const bg = gender === 'Male' ? '3b82f6' : gender === 'Female' ? 'ec4899' : '9ca3af';
    return `https://api.dicebear.com/7.x/initials/svg?seed=${safeSeed}&radius=50&fontFamily=Arial&fontWeight=700&backgroundColor=${bg}`;
  }

  /**
   * Create a person and automatically create PersonPlaceAccess for the user's place
   */
  async create(data: CreatePersonDto, userId: string): Promise<Person> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const normalized = this.normalizeNames(data);
    if (!normalized.imagenProfileUrl || normalized.imagenProfileUrl.length === 0) {
      const initials = this.getInitials(normalized.name, normalized.lastName, normalized.nickname);
      if (initials) {
        normalized.imagenProfileUrl = [this.generateDiceBearUrl(initials, normalized.gender as any)];
      }
    }
    const person = this.personRepository.create(normalized);
    const saved = await this.personRepository.save(person);

    // Create PersonPlaceAccess for the user's place (if they have one)
    if (user.placeId) {
      const access = this.accessRepository.create({
        personId: saved.id,
        placeId: user.placeId,
        accessType: PersonAccessType.OWNER,
        grantedByUserId: userId,
      });
      await this.accessRepository.save(access);
    }

    return saved;
  }

  /**
   * Get all accessible person IDs for a user's place
   */
  private async getAccessiblePersonIds(userId: string): Promise<string[] | null> {
    const user = await this.userService.findById(userId);
    if (!user) return null;

    // ADMIN sees all
    if (isAdmin(user.role)) {
      return null; // null means no filter
    }

    if (!user.placeId) {
      return []; // No place = no access
    }

    // Get persons this place has direct access to
    const directAccess = await this.accessRepository.find({
      where: { placeId: user.placeId },
      select: ['personId'],
    });
    const directIds = directAccess.map((a) => a.personId);

    // Get persons from venues that share with this place
    const sharingVenues = await this.settingsRepository.find({
      where: { sharePersons: true },
    });

    const sharingWithUs = sharingVenues.filter((s) =>
      s.sharePersonsWithPlaceIds.includes(user.placeId!),
    );

    const sharedPlaceIds = sharingWithUs.map((s) => s.placeId);

    let sharedPersonIds: string[] = [];
    if (sharedPlaceIds.length > 0) {
      const sharedAccess = await this.accessRepository.find({
        where: { placeId: In(sharedPlaceIds) },
        select: ['personId'],
      });
      sharedPersonIds = sharedAccess.map((a) => a.personId);
    }

    // Combine and deduplicate
    const allIds = new Set([...directIds, ...sharedPersonIds]);
    return Array.from(allIds);
  }

  async findAll(
    userId: string,
    filters?: {
      gender?: 'Male' | 'Female' | null;
      search?: string;
      sortBy?: 'newest-first' | 'oldest-first' | 'name-asc' | 'name-desc';
    },
    options?: { page?: number; limit?: number; fields?: string[] },
  ): Promise<{ items: Person[]; total: number; page: number; limit: number; hasNext: boolean }> {
    const accessibleIds = await this.getAccessiblePersonIds(userId);

    const qb = this.personRepository.createQueryBuilder('person');

    // Filter by accessible persons (null = no filter for ADMIN)
    if (accessibleIds !== null) {
      if (accessibleIds.length === 0) {
        return { items: [], total: 0, page: 1, limit: options?.limit || 20, hasNext: false };
      }
      qb.andWhere('person.id IN (:...accessibleIds)', { accessibleIds });
    }

    // Filter by gender
    if (filters?.gender !== undefined && filters.gender !== null) {
      qb.andWhere('person.gender = :gender', { gender: filters.gender });
    }

    // Filter by search
    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(person.name) LIKE :search OR LOWER(person.lastName) LIKE :search OR LOWER(person.nickname) LIKE :search)',
        { search: searchTerm }
      );
    }

    // Sorting
    const sortBy = filters?.sortBy || 'newest-first';
    switch (sortBy) {
      case 'oldest-first':
        qb.orderBy('person.createdAt', 'ASC');
        break;
      case 'name-asc':
        qb.orderBy('COALESCE(person.name, \'\') || \' \' || COALESCE(person.lastName, \'\') || \' \' || COALESCE(person.nickname, \'\')', 'ASC');
        break;
      case 'name-desc':
        qb.orderBy('COALESCE(person.name, \'\') || \' \' || COALESCE(person.lastName, \'\') || \' \' || COALESCE(person.nickname, \'\')', 'DESC');
        break;
      case 'newest-first':
      default:
        qb.orderBy('person.createdAt', 'DESC');
        break;
    }

    if (options?.fields && options.fields.length > 0) {
      const allowed = new Set([
        'id', 'name', 'lastName', 'nickname', 'gender', 'createdAt', 'updatedAt',
        'documentNumber', 'city', 'imagenProfileUrl',
      ]);
      const selected = options.fields.filter((f) => allowed.has(f)).map((f) => `person.${f}`);
      if (selected.length > 0) {
        qb.select(selected);
      }
    }

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const [items, total] = await qb.clone().skip((page - 1) * limit).take(limit).getManyAndCount();
    const hasNext = page * limit < total;
    return { items, total, page, limit, hasNext };
  }

  async findOne(id: string, userId: string): Promise<Person> {
    const accessibleIds = await this.getAccessiblePersonIds(userId);

    const person = await this.personRepository.findOne({
      where: { id },
    });
    if (!person) throw new NotFoundException('Person not found');

    // Check access
    if (accessibleIds !== null && !accessibleIds.includes(id)) {
      throw new ForbiddenException('You do not have access to this person');
    }

    return person;
  }

  async update(id: string, data: UpdatePersonDto, userId: string): Promise<Person> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const person = await this.personRepository.findOne({ where: { id } });
    if (!person) throw new NotFoundException('Person not found');

    // Check if user has owner access (not just shared)
    if (!isAdmin(user.role) && user.placeId) {
      const access = await this.accessRepository.findOne({
        where: { personId: id, placeId: user.placeId },
      });
      if (!access || access.accessType !== PersonAccessType.OWNER) {
        throw new ForbiddenException('Only the venue that created this person can edit their details');
      }
    }

    const normalized = this.normalizeNames(data);
    Object.assign(person, normalized);
    return this.personRepository.save(person);
  }

  async remove(id: string, userId: string): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const person = await this.personRepository.findOne({
      where: { id },
    });
    if (!person) throw new NotFoundException('Person not found');

    // Check owner access
    if (!isAdmin(user.role) && user.placeId) {
      const access = await this.accessRepository.findOne({
        where: { personId: id, placeId: user.placeId },
      });
      if (!access || access.accessType !== PersonAccessType.OWNER) {
        throw new ForbiddenException('Only the venue that created this person can delete them');
      }
    }

    // Verify no bans exist
    const banCount = await this.bannedRepository.count({
      where: { person: { id } },
    });

    if (banCount > 0) {
      throw new ConflictException(
        'Cannot delete person with ban history. Please remove all bans first.',
      );
    }

    const result = await this.personRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Person not found');
  }
}

