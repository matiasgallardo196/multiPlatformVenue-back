import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { PlaceSettings } from '../../shared/entities/placeSettings.entity';
import { PersonPlaceAccess, PersonAccessType } from '../../shared/entities/personPlaceAccess.entity';
import { Place } from '../../shared/entities/place.entity';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/user.entity';
import { isAdmin } from '../auth/role-utils';
import { UpdatePlaceSettingsDto } from './dto/update-place-settings.dto';

@Injectable()
export class PlaceSettingsService {
  constructor(
    @InjectRepository(PlaceSettings)
    private readonly settingsRepository: Repository<PlaceSettings>,
    @InjectRepository(PersonPlaceAccess)
    private readonly accessRepository: Repository<PersonPlaceAccess>,
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
    private readonly userService: UserService,
  ) {}

  /**
   * Get settings for a place. Creates default settings if not exist.
   */
  async getSettings(placeId: string, userId: string): Promise<PlaceSettings> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Only HEAD_MANAGER of this place or ADMIN can view settings
    if (!isAdmin(user.role)) {
      if (user.role !== UserRole.HEAD_MANAGER || user.placeId !== placeId) {
        throw new ForbiddenException('You can only view settings for your own venue');
      }
    }

    let settings = await this.settingsRepository.findOne({
      where: { placeId },
    });

    // Create default settings if not exist
    if (!settings) {
      settings = this.settingsRepository.create({
        placeId,
        acceptExternalBans: false,
        acceptBansFromPlaceIds: [],
        sharePersons: false,
        sharePersonsWithPlaceIds: [],
      });
      await this.settingsRepository.save(settings);
    }

    return settings;
  }

  /**
   * Update settings for a place
   */
  async updateSettings(
    placeId: string,
    dto: UpdatePlaceSettingsDto,
    userId: string,
  ): Promise<PlaceSettings> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Only HEAD_MANAGER of this place or ADMIN can update settings
    if (!isAdmin(user.role)) {
      if (user.role !== UserRole.HEAD_MANAGER || user.placeId !== placeId) {
        throw new ForbiddenException('You can only update settings for your own venue');
      }
    }

    // Get or create settings
    let settings = await this.settingsRepository.findOne({
      where: { placeId },
    });

    if (!settings) {
      settings = this.settingsRepository.create({ placeId });
    }

    // Apply updates
    if (dto.acceptExternalBans !== undefined) {
      settings.acceptExternalBans = dto.acceptExternalBans;
    }
    if (dto.acceptBansFromPlaceIds !== undefined) {
      settings.acceptBansFromPlaceIds = dto.acceptBansFromPlaceIds;
    }
    if (dto.sharePersons !== undefined) {
      settings.sharePersons = dto.sharePersons;
    }
    if (dto.sharePersonsWithPlaceIds !== undefined) {
      settings.sharePersonsWithPlaceIds = dto.sharePersonsWithPlaceIds;
    }

    // Validation: if switch is ON, must have at least one venue selected
    if (settings.acceptExternalBans && settings.acceptBansFromPlaceIds.length === 0) {
      throw new BadRequestException('You must select at least one venue to accept ban requests from');
    }
    if (settings.sharePersons && settings.sharePersonsWithPlaceIds.length === 0) {
      throw new BadRequestException('You must select at least one venue to share persons with');
    }

    // Auto-clear arrays if switch is OFF
    if (!settings.acceptExternalBans) {
      settings.acceptBansFromPlaceIds = [];
    }
    if (!settings.sharePersons) {
      settings.sharePersonsWithPlaceIds = [];
    }

    // Validate that placeIds exist
    const allPlaceIds = [
      ...settings.acceptBansFromPlaceIds,
      ...settings.sharePersonsWithPlaceIds,
    ];
    if (allPlaceIds.length > 0) {
      const existingPlaces = await this.placeRepository.count({
        where: { id: In(allPlaceIds) },
      });
      if (existingPlaces !== new Set(allPlaceIds).size) {
        throw new BadRequestException('Some selected venues do not exist');
      }
    }

    return this.settingsRepository.save(settings);
  }

  /**
   * Get venues that accept ban requests from a given place
   */
  async getVenuesAcceptingBansFrom(fromPlaceId: string): Promise<Place[]> {
    // Find all settings where acceptExternalBans is true
    // and acceptBansFromPlaceIds includes fromPlaceId
    const allSettings = await this.settingsRepository.find({
      where: { acceptExternalBans: true },
      relations: ['place'],
    });

    return allSettings
      .filter((s) => s.acceptBansFromPlaceIds.includes(fromPlaceId))
      .map((s) => s.place)
      .filter((p) => p != null);
  }

  /**
   * Get venues that share persons with a given place
   */
  async getVenuesSharingPersonsWith(withPlaceId: string): Promise<Place[]> {
    const allSettings = await this.settingsRepository.find({
      where: { sharePersons: true },
      relations: ['place'],
    });

    return allSettings
      .filter((s) => s.sharePersonsWithPlaceIds.includes(withPlaceId))
      .map((s) => s.place)
      .filter((p) => p != null);
  }

  /**
   * Create person-place access when a person is created
   */
  async createPersonAccess(
    personId: string,
    placeId: string,
    userId: string,
    accessType: PersonAccessType = PersonAccessType.OWNER,
  ): Promise<PersonPlaceAccess> {
    const existing = await this.accessRepository.findOne({
      where: { personId, placeId },
    });

    if (existing) {
      return existing; // Already has access
    }

    const access = this.accessRepository.create({
      personId,
      placeId,
      accessType,
      grantedByUserId: userId,
    });

    return this.accessRepository.save(access);
  }

  /**
   * Check if a place has access to a person
   */
  async hasAccessToPerson(placeId: string, personId: string): Promise<boolean> {
    const access = await this.accessRepository.findOne({
      where: { personId, placeId },
    });
    return !!access;
  }

  /**
   * Get all places that the requesting user's place can see
   * (for the venue selector when creating a ban)
   */
  async getAvailableVenuesForBan(userId: string): Promise<Place[]> {
    const user = await this.userService.findById(userId);
    if (!user || !user.placeId) {
      return [];
    }

    // ADMIN sees all places
    if (isAdmin(user.role)) {
      return this.placeRepository.find();
    }

    // Get venues that accept bans from user's place
    const acceptingVenues = await this.getVenuesAcceptingBansFrom(user.placeId);
    
    // Also include user's own place
    const ownPlace = await this.placeRepository.findOne({
      where: { id: user.placeId },
    });

    const result = ownPlace ? [ownPlace, ...acceptingVenues] : acceptingVenues;
    
    // Remove duplicates
    const uniqueIds = new Set<string>();
    return result.filter((p) => {
      if (uniqueIds.has(p.id)) return false;
      uniqueIds.add(p.id);
      return true;
    });
  }

  /**
   * Migrate existing persons: Create PersonPlaceAccess records based on approved banned places.
   * This should be run once to populate access for existing data.
   */
  async migrateExistingPersonAccess(userId: string): Promise<{ created: number; skipped: number }> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Only ADMIN can run migration
    if (!isAdmin(user.role)) {
      throw new ForbiddenException('Only admins can run data migration');
    }

    // Get all approved banned places with person info
    const bannedPlaces = await this.accessRepository.manager.query(`
      SELECT DISTINCT bp."placeId", b."personId", b."createdByUserId"
      FROM "BannedPlaces" bp
      INNER JOIN banned b ON bp."bannedId" = b.id
      WHERE bp.status = 'approved'
    `);

    let created = 0;
    let skipped = 0;

    for (const row of bannedPlaces) {
      const existing = await this.accessRepository.findOne({
        where: { personId: row.personId, placeId: row.placeId },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.accessRepository.save(
        this.accessRepository.create({
          personId: row.personId,
          placeId: row.placeId,
          accessType: PersonAccessType.OWNER, // Treat existing as owner
          grantedByUserId: row.createdByUserId || userId,
        }),
      );
      created++;
    }

    return { created, skipped };
  }
}

