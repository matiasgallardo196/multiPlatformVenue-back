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
import { PersonHistory, PersonHistoryAction } from 'src/shared/entities/personHistory.entity';
import { Place } from 'src/shared/entities/place.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { UserService } from '../user/user.service';
import { isAdmin } from '../auth/role-utils';

export interface PersonWithAccess extends Person {
  ownerPlaceId?: string;
  ownerPlaceName?: string;
  accessType?: PersonAccessType;
  isShared?: boolean;
  sharedWithPlaces?: { id: string; name: string }[];
  banStatus?: 'active' | 'pending' | 'expired' | 'none';
}

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
    @InjectRepository(PersonHistory)
    private readonly historyRepository: Repository<PersonHistory>,
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
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

  private async recordHistory(
    personId: string,
    action: PersonHistoryAction,
    userId: string,
    placeId: string | null,
    changes?: { field: string; oldValue: any; newValue: any }[] | null,
    notes?: string | null,
  ): Promise<void> {
    await this.historyRepository.save(
      this.historyRepository.create({
        personId,
        action,
        performedByUserId: userId,
        placeId,
        changes,
        notes,
      }),
    );
  }

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

    if (user.placeId) {
      const access = this.accessRepository.create({
        personId: saved.id,
        placeId: user.placeId,
        accessType: PersonAccessType.OWNER,
        grantedByUserId: userId,
      });
      await this.accessRepository.save(access);
    }

    await this.recordHistory(saved.id, PersonHistoryAction.CREATED, userId, user.placeId || null);

    return saved;
  }

  private async getAccessiblePersonIds(userId: string): Promise<string[] | null> {
    const user = await this.userService.findById(userId);
    if (!user) return null;

    if (isAdmin(user.role)) {
      return null;
    }

    if (!user.placeId) {
      return [];
    }

    const directAccess = await this.accessRepository.find({
      where: { placeId: user.placeId },
      select: ['personId'],
    });
    const directIds = directAccess.map((a) => a.personId);

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

    const allIds = new Set([...directIds, ...sharedPersonIds]);
    return Array.from(allIds);
  }

  private async getAccessInfo(personId: string, forPlaceId: string | null): Promise<{
    ownerPlaceId: string | null;
    ownerPlaceName: string | null;
    accessType: PersonAccessType | null;
    isShared: boolean;
    accessCount: number;
    sharedWithPlaces: { id: string; name: string }[];
  }> {
    const allAccess = await this.accessRepository.find({
      where: { personId },
      relations: ['place'],
    });

    const ownerAccess = allAccess.find((a) => a.accessType === PersonAccessType.OWNER);
    const myAccess = forPlaceId ? allAccess.find((a) => a.placeId === forPlaceId) : null;

    // Build list of venues that have SHARED access (exclude owner for tooltip)
    const ownerPlaceId = ownerAccess?.placeId;
    const sharedWithPlaces = allAccess
      .filter((a) => a.place?.name && a.placeId !== ownerPlaceId)
      .map((a) => ({ id: a.placeId, name: a.place!.name! }));

    return {
      ownerPlaceId: ownerAccess?.placeId || null,
      ownerPlaceName: ownerAccess?.place?.name || null,
      accessType: myAccess?.accessType || null,
      isShared: allAccess.length > 1,
      accessCount: allAccess.length,
      sharedWithPlaces,
    };
  }

  async findAll(
    userId: string,
    filters?: {
      gender?: 'Male' | 'Female' | null;
      search?: string;
      sortBy?: 'newest-first' | 'oldest-first' | 'name-asc' | 'name-desc';
      banStatus?: 'active' | 'pending' | 'expired' | 'none';
      accessType?: 'owner' | 'shared';
      ownerPlaceId?: string;
    },
    options?: { page?: number; limit?: number; fields?: string[] },
  ): Promise<{ items: PersonWithAccess[]; total: number; page: number; limit: number; hasNext: boolean }> {
    const user = await this.userService.findById(userId);
    const accessibleIds = await this.getAccessiblePersonIds(userId);

    const qb = this.personRepository.createQueryBuilder('person');

    if (accessibleIds !== null) {
      if (accessibleIds.length === 0) {
        return { items: [], total: 0, page: 1, limit: options?.limit || 20, hasNext: false };
      }
      qb.andWhere('person.id IN (:...accessibleIds)', { accessibleIds });
    }

    if (filters?.gender !== undefined && filters.gender !== null) {
      qb.andWhere('person.gender = :gender', { gender: filters.gender });
    }

    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(person.name) LIKE :search OR LOWER(person.lastName) LIKE :search OR LOWER(person.nickname) LIKE :search)',
        { search: searchTerm }
      );
    }

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
    
    // Check if we need post-query filtering
    const needsPostQueryFiltering = filters?.banStatus || filters?.accessType || filters?.ownerPlaceId;
    
    let items: Person[];
    let dbTotal: number;
    
    if (needsPostQueryFiltering) {
      // Fetch ALL items for post-query filtering
      [items, dbTotal] = await qb.getManyAndCount();
    } else {
      // Use DB pagination for efficiency
      [items, dbTotal] = await qb.clone().skip((page - 1) * limit).take(limit).getManyAndCount();
    }

    const enrichedItems: PersonWithAccess[] = await Promise.all(
      items.map(async (person) => {
        const accessInfo = await this.getAccessInfo(person.id, user?.placeId || null);
        
        // Get ban status for this person
        const bans = await this.bannedRepository
          .createQueryBuilder('b')
          .leftJoinAndSelect('b.bannedPlaces', 'bp')
          .where('b.personId = :personId', { personId: person.id })
          .getMany();
        
        let banStatus: 'active' | 'pending' | 'expired' | 'none' = 'none';
        const now = new Date();
        let hadBans = bans.length > 0;
        
        for (const ban of bans) {
          const startingDate = ban.startingDate ? new Date(ban.startingDate) : null;
          const endingDate = ban.endingDate ? new Date(ban.endingDate) : null;
          const isInValidPeriod = startingDate && startingDate <= now && (!endingDate || endingDate >= now);
          
          const hasApproved = ban.bannedPlaces?.some((bp) => bp.status === 'approved');
          const hasPending = ban.bannedPlaces?.some((bp) => bp.status === 'pending');
          
          if (hasApproved && isInValidPeriod) {
            banStatus = 'active';
            break; // Active is highest priority
          }
          if (hasPending) {
            banStatus = 'pending';
          }
        }
        
        // If had bans but none are active or pending, mark as expired
        if (hadBans && banStatus === 'none') {
          banStatus = 'expired';
        }
        
        return {
          ...person,
          ownerPlaceId: accessInfo.ownerPlaceId || undefined,
          ownerPlaceName: accessInfo.ownerPlaceName || undefined,
          accessType: accessInfo.accessType || undefined,
          isShared: accessInfo.isShared,
          sharedWithPlaces: accessInfo.sharedWithPlaces.length > 0 ? accessInfo.sharedWithPlaces : undefined,
          banStatus,
        };
      }),
    );
    
    // Apply post-query filters
    let filteredItems = enrichedItems;
    
    if (filters?.banStatus) {
      filteredItems = filteredItems.filter((p) => p.banStatus === filters.banStatus);
    }
    
    if (filters?.accessType) {
      if (filters.accessType === 'shared') {
        // Shared with me means I am NOT the owner
        filteredItems = filteredItems.filter((p) => p.accessType === PersonAccessType.SHARED);
      } else {
        filteredItems = filteredItems.filter((p) => p.accessType === filters.accessType);
      }
    }
    
    if (filters?.ownerPlaceId) {
      filteredItems = filteredItems.filter((p) => p.ownerPlaceId === filters.ownerPlaceId);
    }
    
    // Apply pagination to filtered results
    const total = needsPostQueryFiltering ? filteredItems.length : dbTotal;
    const paginatedItems = needsPostQueryFiltering 
      ? filteredItems.slice((page - 1) * limit, page * limit)
      : filteredItems;
    const hasNext = page * limit < total;

    return { items: paginatedItems, total, page, limit, hasNext };
  }

  async findOne(id: string, userId: string): Promise<PersonWithAccess> {
    const user = await this.userService.findById(userId);
    const accessibleIds = await this.getAccessiblePersonIds(userId);

    const person = await this.personRepository.findOne({
      where: { id },
    });
    if (!person) throw new NotFoundException('Person not found');

    if (accessibleIds !== null && !accessibleIds.includes(id)) {
      throw new ForbiddenException('You do not have access to this person');
    }

    const accessInfo = await this.getAccessInfo(id, user?.placeId || null);

    return {
      ...person,
      ownerPlaceId: accessInfo.ownerPlaceId || undefined,
      ownerPlaceName: accessInfo.ownerPlaceName || undefined,
      accessType: accessInfo.accessType || undefined,
      isShared: accessInfo.isShared,
      sharedWithPlaces: accessInfo.sharedWithPlaces.length > 0 ? accessInfo.sharedWithPlaces : undefined,
    };
  }

  async update(id: string, data: UpdatePersonDto, userId: string): Promise<Person> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const person = await this.personRepository.findOne({ where: { id } });
    if (!person) throw new NotFoundException('Person not found');

    if (!isAdmin(user.role) && user.placeId) {
      const access = await this.accessRepository.findOne({
        where: { personId: id, placeId: user.placeId },
      });
      if (!access || access.accessType !== PersonAccessType.OWNER) {
        throw new ForbiddenException('Only the venue that created this person can edit their details');
      }
    }

    const changes: { field: string; oldValue: any; newValue: any }[] = [];
    const normalized = this.normalizeNames(data);

    for (const key of Object.keys(normalized) as (keyof typeof normalized)[]) {
      const oldVal = (person as any)[key];
      const newVal = normalized[key];
      if (newVal !== undefined && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ field: key, oldValue: oldVal, newValue: newVal });
      }
    }

    Object.assign(person, normalized);
    const saved = await this.personRepository.save(person);

    if (changes.length > 0) {
      await this.recordHistory(id, PersonHistoryAction.UPDATED, userId, user.placeId || null, changes);
    }

    return saved;
  }

  async remove(id: string, userId: string): Promise<{ removed: 'access' | 'person'; message: string }> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const person = await this.personRepository.findOne({
      where: { id },
    });
    if (!person) throw new NotFoundException('Person not found');

    const allAccess = await this.accessRepository.find({
      where: { personId: id },
    });

    const myAccess = user.placeId 
      ? allAccess.find((a) => a.placeId === user.placeId) 
      : null;

    if (!isAdmin(user.role) && !myAccess) {
      throw new ForbiddenException('You do not have access to this person');
    }

    if (user.placeId) {
      const myBanCount = await this.bannedRepository
        .createQueryBuilder('b')
        .innerJoin('b.bannedPlaces', 'bp')
        .where('b.personId = :personId', { personId: id })
        .andWhere('bp.placeId = :placeId', { placeId: user.placeId })
        .getCount();

      if (myBanCount > 0) {
        throw new ConflictException('Cannot remove person with active bans in your venue. Remove the bans first.');
      }
    }

    if (allAccess.length > 1 && myAccess && user.placeId) {
      await this.accessRepository.delete({ personId: id, placeId: user.placeId });

      if (myAccess.accessType === PersonAccessType.OWNER) {
        const otherAccess = allAccess.find((a) => a.placeId !== user.placeId);
        if (otherAccess) {
          otherAccess.accessType = PersonAccessType.OWNER;
          await this.accessRepository.save(otherAccess);

          await this.recordHistory(
            id,
            PersonHistoryAction.OWNERSHIP_TRANSFERRED,
            userId,
            otherAccess.placeId,
            null,
            `Ownership transferred from ${user.placeId} to ${otherAccess.placeId}`,
          );
        }
      }

      await this.recordHistory(id, PersonHistoryAction.ACCESS_REMOVED, userId, user.placeId || null);

      return {
        removed: 'access',
        message: 'Your venue access to this person has been removed. The person still exists for other venues.',
      };
    }

    const totalBanCount = await this.bannedRepository.count({
      where: { person: { id } },
    });

    if (totalBanCount > 0) {
      throw new ConflictException(
        'Cannot delete person with ban history. Please remove all bans first.',
      );
    }

    await this.accessRepository.delete({ personId: id });
    const result = await this.personRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Person not found');

    return {
      removed: 'person',
      message: 'Person has been permanently deleted.',
    };
  }

  async getHistory(id: string, userId: string): Promise<PersonHistory[]> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const accessibleIds = await this.getAccessiblePersonIds(userId);
    if (accessibleIds !== null && !accessibleIds.includes(id)) {
      throw new ForbiddenException('You do not have access to this person');
    }

    const history = await this.historyRepository.find({
      where: { personId: id },
      relations: ['place'],
      order: { performedAt: 'DESC' },
    });

    const userIds = [...new Set(history.map((h) => h.performedByUserId))];
    const users = await Promise.all(userIds.map((uid) => this.userService.findById(uid)));
    const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, u!.userName]));

    return history.map((h) => ({
      ...h,
      performedByUserName: userMap.get(h.performedByUserId) || 'Unknown',
    })) as any;
  }
}
