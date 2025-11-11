import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
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
import { BannedPlace, BannedPlaceStatus } from 'src/shared/entities/bannedPlace.entity';
import { Place } from 'src/shared/entities/place.entity';
import { BannedHistory, BannedHistoryAction } from 'src/shared/entities/bannedHistory.entity';
import { CreateBannedDto } from './dto/create-banned.dto';
import { UpdateBannedDto } from './dto/update-banned.dto';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/user.entity';

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
    @InjectRepository(BannedHistory)
    private readonly bannedHistoryRepository: Repository<BannedHistory>,
    private readonly userService: UserService,
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

  /**
   * Verifica qué lugares tienen baneos activos para una persona (método público)
   * Un baneo es "activo" si: startingDate <= now AND (endingDate is NULL OR endingDate >= now)
   */
  async checkActiveBansByPersonAndPlaces(
    personId: string,
    placeIds: string[],
  ): Promise<{
    personId: string;
    activeBans: Array<{
      placeId: string;
      placeName: string;
      bannedId: string;
      startingDate: Date;
      endingDate: Date | null;
      status: BannedPlaceStatus;
    }>;
  }> {
    const { placesWithActiveBans } = await this.checkActiveBansForPlaces(
      personId,
      placeIds,
    );
    return {
      personId,
      activeBans: placesWithActiveBans,
    };
  }

  /**
   * Verifica qué lugares tienen baneos activos para una persona (método privado interno)
   * Un baneo es "activo" si: startingDate <= now AND (endingDate is NULL OR endingDate >= now)
   * 
   * @param personId ID de la persona
   * @param placeIds Lista de IDs de lugares a verificar
   * @returns Información sobre lugares con baneos activos
   */
  private async checkActiveBansForPlaces(
    personId: string,
    placeIds: string[],
  ): Promise<{
    placesWithActiveBans: Array<{
      placeId: string;
      placeName: string;
      bannedId: string;
      startingDate: Date;
      endingDate: Date | null;
      status: BannedPlaceStatus;
    }>;
  }> {
    const now = new Date();
    
    // Buscar baneos activos de la persona en los lugares especificados
    const activeBannedPlaces = await this.bannedPlaceRepository
      .createQueryBuilder('bp')
      .leftJoinAndSelect('bp.banned', 'banned')
      .leftJoinAndSelect('bp.place', 'place')
      .where('banned.personId = :personId', { personId })
      .andWhere('bp.placeId IN (:...placeIds)', { placeIds })
      .andWhere('bp.status = :approvedStatus', { approvedStatus: BannedPlaceStatus.APPROVED })
      .andWhere('banned.startingDate <= :now', { now })
      .andWhere(
        '(banned.endingDate IS NULL OR banned.endingDate >= :now)',
        { now },
      )
      .getMany();

    const placesWithActiveBans = activeBannedPlaces.map((bp) => ({
      placeId: bp.placeId,
      placeName: bp.place?.name || bp.placeId,
      bannedId: bp.bannedId,
      startingDate: bp.banned.startingDate,
      endingDate: bp.banned.endingDate,
      status: bp.status,
    }));

    return { placesWithActiveBans };
  }

  async create(data: CreateBannedDto, userId: string): Promise<Banned> {
    // Obtener usuario completo con place
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validar que si es head-manager o manager, tiene placeId
    if (
      (user.role === UserRole.HEAD_MANAGER || user.role === UserRole.MANAGER) &&
      !user.placeId
    ) {
      throw new ForbiddenException('User must have a place assigned to create bans');
    }

    // Validar que todos los placeIds existen (placeIds es obligatorio)
    const places = await this.placeRepository.find({
      where: { id: In(data.placeIds) },
    });
    if (places.length !== data.placeIds.length) {
      throw new NotFoundException('Some places do not exist');
    }

    // Managers y head-managers pueden agregar cualquier place
    // La diferencia es que head-managers auto-aprueban su place, managers dejan todo pending

    const person = await this.personRepository.findOne({
      where: { id: data.personId },
    });
    if (!person) throw new NotFoundException('Person not found');

    // Regla: si ya existe un baneo ACTIVO en el local del usuario (A),
    // bloquear la creación de un nuevo baneo (aunque se quiera incluir B).
    // Debe editarse el baneo existente para agregar B.
    if (user.placeId) {
      const now = new Date();
      const existingActiveFromUserPlace = await this.bannedRepository
        .createQueryBuilder('b')
        .leftJoin('b.bannedPlaces', 'bp')
        .where('b.personId = :personId', { personId: data.personId })
        .andWhere('bp.placeId = :placeId', { placeId: user.placeId })
        .andWhere('bp.status = :approvedStatus', { approvedStatus: BannedPlaceStatus.APPROVED })
        .andWhere('b.startingDate <= :now', { now })
        .andWhere('(b.endingDate IS NULL OR b.endingDate >= :now)', { now })
        .getOne();

      if (existingActiveFromUserPlace) {
        throw new ConflictException(
          'Person already has an active ban in your place. Please edit the existing ban to add other places.',
        );
      }
    }

    // Verificar lugares con baneos activos y filtrarlos
    const { placesWithActiveBans } = await this.checkActiveBansForPlaces(
      data.personId,
      data.placeIds,
    );
    
    const placesWithActiveBansIds = new Set(
      placesWithActiveBans.map((p) => p.placeId),
    );
    const availablePlaceIds = data.placeIds.filter(
      (id) => !placesWithActiveBansIds.has(id),
    );

    // Si todos los lugares tienen baneos activos, lanzar excepción
    if (availablePlaceIds.length === 0) {
      throw new ConflictException(
        `Esta persona ya tiene baneos activos en todos los lugares seleccionados: ${placesWithActiveBans.map((p) => p.placeName).join(', ')}`,
      );
    }

    // Filtrar places para solo incluir los disponibles
    const availablePlaces = places.filter((p) =>
      availablePlaceIds.includes(p.id),
    );

    const payload: Partial<Banned> = {
      incidentNumber: data.incidentNumber,
      startingDate: new Date(data.startingDate as any),
      motive: data.motive,
      peopleInvolved:
        data.peopleInvolved && data.peopleInvolved.trim().length > 0
          ? data.peopleInvolved.trim()
          : null,
      incidentReport:
        data.incidentReport && data.incidentReport.trim().length > 0
          ? data.incidentReport.trim()
          : null,
      actionTaken:
        data.actionTaken && data.actionTaken.trim().length > 0
          ? data.actionTaken.trim()
          : null,
      policeNotified: data.policeNotified ?? false,
      policeNotifiedDate:
        data.policeNotified && data.policeNotifiedDate
          ? new Date(data.policeNotifiedDate as any)
          : null,
      policeNotifiedTime:
        data.policeNotified && data.policeNotifiedTime
          ? data.policeNotifiedTime.trim()
          : null,
      policeNotifiedEvent:
        data.policeNotified && data.policeNotifiedEvent
          ? data.policeNotifiedEvent.trim()
          : null,
      person,
      endingDate: new Date(data.endingDate as any),
    };
    payload.howlong = this.computeHowLong(
      payload.startingDate,
      payload.endingDate ?? null,
    );
    payload.createdByUserId = userId;
    const banned = this.bannedRepository.create(payload);
    let saved: Banned;
    try {
      saved = await this.bannedRepository.save(banned);
    } catch (err: any) {
      // Unicidad de incidentNumber
      // Usa excepciones HTTP estándar de NestJS según la guía del proyecto
      if (err && (err.code === '23505' || /unique/i.test(String(err.message || '')))) {
        throw new ConflictException('Incident number already exists');
      }
      throw err;
    }

    // Crear relaciones con places (solo los disponibles, sin baneos activos)
    const now = new Date();
    
    // Determinar estado de aprobación según el rol del creador
    const links = availablePlaces.map((place) => {
      let status = BannedPlaceStatus.PENDING;
      let approvedByUserId: string | null = null;
      let approvedAt: Date | null = null;

      // Si el creador es head-manager, solo su propio place queda aprobado automáticamente
      // Los managers dejan todos los places (incluido su propio) como pending
      if (user.role === UserRole.HEAD_MANAGER && place.id === user.placeId) {
        status = BannedPlaceStatus.APPROVED;
        approvedByUserId = userId;
        approvedAt = now;
      }
      // Para managers: todos los places quedan pending (incluido su propio place)

      return this.bannedPlaceRepository.create({
        bannedId: saved.id,
        placeId: place.id,
        banned: saved,
        place,
        status,
        approvedByUserId,
        approvedAt,
      });
    });
    await this.bannedPlaceRepository.save(links);

    // Registrar creación en historial
    await this.bannedHistoryRepository.save(
      this.bannedHistoryRepository.create({
        bannedId: saved.id,
        banned: saved,
        action: BannedHistoryAction.CREATED,
        performedByUserId: userId,
        details: {
          placeIds: availablePlaceIds, // Solo los lugares donde se creó el baneo
          filteredPlaceIds: Array.from(placesWithActiveBansIds), // Lugares filtrados por tener baneos activos
          originalPlaceIds: data.placeIds, // Todos los lugares que se intentaron agregar
          incidentNumber: data.incidentNumber,
          startingDate: data.startingDate,
          endingDate: data.endingDate,
        },
      }),
    );
    
    return saved;
  }

  async findAll(userId: string, sortBy?: string): Promise<Banned[]> {
    // Obtener usuario completo con place
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Función helper para aplicar ordenamiento
    const applySorting = (queryBuilder: any, sortBy?: string) => {
      const sort = sortBy || 'violations-desc';
      switch (sort) {
        case 'violations-asc':
          queryBuilder.orderBy('banned.violationsCount', 'ASC');
          break;
        case 'starting-date-desc':
          queryBuilder.orderBy('banned.startingDate', 'DESC');
          break;
        case 'starting-date-asc':
          queryBuilder.orderBy('banned.startingDate', 'ASC');
          break;
        case 'ending-date-desc':
          queryBuilder.addOrderBy('CASE WHEN banned.endingDate IS NULL THEN 1 ELSE 0 END', 'ASC')
            .addOrderBy('banned.endingDate', 'DESC');
          break;
        case 'ending-date-asc':
          queryBuilder.addOrderBy('CASE WHEN banned.endingDate IS NULL THEN 1 ELSE 0 END', 'ASC')
            .addOrderBy('banned.endingDate', 'ASC');
          break;
        case 'person-name-asc':
          queryBuilder.orderBy('COALESCE(person.name, \'\') || \' \' || COALESCE(person.lastName, \'\') || \' \' || COALESCE(person.nickname, \'\')', 'ASC');
          break;
        case 'person-name-desc':
          queryBuilder.orderBy('COALESCE(person.name, \'\') || \' \' || COALESCE(person.lastName, \'\') || \' \' || COALESCE(person.nickname, \'\')', 'DESC');
          break;
        case 'violations-desc':
        default:
          queryBuilder.orderBy('banned.violationsCount', 'DESC');
          break;
      }
    };

    // Si es head-manager, manager o staff, filtrar por city y solo bans aprobados
    if (
      user.role === UserRole.HEAD_MANAGER ||
      user.role === UserRole.MANAGER ||
      user.role === UserRole.STAFF
    ) {
      if (!user.place?.city) {
        // Si no tiene city, retornar lista vacía
        return [];
      }

      // Filtrar por city y solo mostrar bans donde todos los places relevantes están aprobados
      // Un ban es visible si todos sus places que pertenecen a la city del usuario están aprobados
      const queryBuilder = this.bannedRepository
        .createQueryBuilder('banned')
        .leftJoinAndSelect('banned.person', 'person')
        .leftJoinAndSelect('banned.bannedPlaces', 'bannedPlaces')
        .leftJoinAndSelect('bannedPlaces.place', 'place')
        .where('place.city = :city', { city: user.place.city })
        .andWhere('bannedPlaces.status = :approvedStatus', {
          approvedStatus: BannedPlaceStatus.APPROVED,
        });
      
      applySorting(queryBuilder, sortBy);
      
      return queryBuilder.getMany()
        .then((bans) => {
          // Filtrar para asegurar que todos los places del ban en esa city están aprobados
          return bans.filter((ban) => {
            const placesInCity = ban.bannedPlaces?.filter(
              (bp) => bp.place?.city === user.place?.city,
            ) || [];
            if (placesInCity.length === 0) return false;
            return placesInCity.every(
              (bp) => bp.status === BannedPlaceStatus.APPROVED,
            );
          });
        });
    }

    // Para otros roles (admin, editor, viewer), retornar todos los bans aprobados
    // Un ban es visible si todos sus places están aprobados
    const queryBuilder = this.bannedRepository
      .createQueryBuilder('banned')
      .leftJoinAndSelect('banned.person', 'person')
      .leftJoinAndSelect('banned.bannedPlaces', 'bannedPlaces')
      .leftJoinAndSelect('bannedPlaces.place', 'place');
    
    applySorting(queryBuilder, sortBy);
    
    return queryBuilder.getMany()
      .then((bans) => {
        // Filtrar para asegurar que todos los places del ban están aprobados
        return bans.filter((ban) => {
          if (!ban.bannedPlaces || ban.bannedPlaces.length === 0) return false;
          return ban.bannedPlaces.every(
            (bp) => bp.status === BannedPlaceStatus.APPROVED,
          );
        });
      });
  }

  async addViolation(bannedId: string, userId: string): Promise<Banned> {
    // Obtener usuario para validar permisos y alcance
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Solo managers y head-managers pueden agregar violaciones
    if (user.role !== UserRole.MANAGER && user.role !== UserRole.HEAD_MANAGER) {
      throw new ForbiddenException('Only managers and head-managers can add violations');
    }

    const banned = await this.bannedRepository.findOne({
      where: { id: bannedId },
      relations: ['bannedPlaces', 'bannedPlaces.place'],
    });
    if (!banned) throw new NotFoundException('Ban not found');

    // Si es manager/head-manager, validar que tenga acceso por su place/city
    if (user.place?.city) {
      const hasAccess = banned.bannedPlaces?.some(
        (bp) => bp.place?.city === user.place?.city,
      );
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this ban');
      }
    }

    // Incrementar contador y registrar fecha actual
    const now = new Date();
    banned.violationsCount = (banned.violationsCount ?? 0) + 1;
    const currentDates = Array.isArray((banned as any).violationDates)
      ? (banned as any).violationDates
      : [];
    banned.violationDates = [...currentDates, now];

    return this.bannedRepository.save(banned);
  }

  async findOne(id: string, userId: string): Promise<Banned> {
    const banned = await this.bannedRepository.findOne({
      where: { id },
      relations: ['person', 'bannedPlaces', 'bannedPlaces.place'],
    });
    if (!banned) throw new NotFoundException('Ban not found');

    // Obtener usuario completo con place
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Si es head-manager, manager o staff, validar que el ban pertenece a su city
    if (
      user.role === UserRole.HEAD_MANAGER ||
      user.role === UserRole.MANAGER ||
      user.role === UserRole.STAFF
    ) {
      if (!user.place?.city) {
        throw new ForbiddenException('User must have a place assigned');
      }

      // Verificar que al menos un place del ban pertenece a la city del usuario
      const hasAccess = banned.bannedPlaces?.some(
        (bp) => bp.place?.city === user.place?.city,
      );
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this ban');
      }
    }

    return banned;
  }

  async update(id: string, data: UpdateBannedDto, userId: string): Promise<Banned> {
    // Obtener usuario completo con place
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validar que si es head-manager o manager, tiene placeId
    if (
      (user.role === UserRole.HEAD_MANAGER || user.role === UserRole.MANAGER) &&
      !user.placeId
    ) {
      throw new ForbiddenException('User must have a place assigned to update bans');
    }

    // Obtener el ban con sus places y persona
    const banned = await this.bannedRepository.findOne({
      where: { id },
      relations: ['bannedPlaces', 'bannedPlaces.place', 'person'],
    });
    if (!banned) throw new NotFoundException('Ban not found');

    // Validar que el ban pertenece a un place del usuario
    if (user.role === UserRole.HEAD_MANAGER || user.role === UserRole.MANAGER) {
      const hasAccess = banned.bannedPlaces?.some(
        (bp) => bp.placeId === user.placeId,
      );
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to update this ban');
      }
    }

    // Validar nuevos placeIds si se están actualizando
    if (data.placeIds && data.placeIds.length > 0) {
      const places = await this.placeRepository.find({
        where: { id: In(data.placeIds) },
      });
      if (places.length !== data.placeIds.length) {
        throw new NotFoundException('Some places do not exist');
      }

      // Managers y head-managers pueden agregar cualquier place
      // La diferencia es que head-managers auto-aprueban su place, managers dejan todo pending
    }
    
    // Handle optional string fields: convert empty strings to null
    const updateData = { ...data };
    if (updateData.peopleInvolved !== undefined) {
      updateData.peopleInvolved =
        updateData.peopleInvolved && updateData.peopleInvolved.trim().length > 0
          ? updateData.peopleInvolved.trim()
          : null;
    }
    if (updateData.incidentReport !== undefined) {
      updateData.incidentReport =
        updateData.incidentReport && updateData.incidentReport.trim().length > 0
          ? updateData.incidentReport.trim()
          : null;
    }
    if (updateData.actionTaken !== undefined) {
      updateData.actionTaken =
        updateData.actionTaken && updateData.actionTaken.trim().length > 0
          ? updateData.actionTaken.trim()
          : null;
    }

    // Verificar si se modificaron las fechas
    const datesChanged = 
      (updateData.startingDate !== undefined && 
       updateData.startingDate !== banned.startingDate?.toISOString()) ||
      (updateData.endingDate !== undefined && 
       updateData.endingDate !== banned.endingDate?.toISOString());

    // Handle police notified fields
    const policeNotifiedFields: Partial<Banned> = {};
    if (updateData.policeNotified !== undefined) {
      if (updateData.policeNotified === false) {
        // If set to false, clear all related fields
        policeNotifiedFields.policeNotifiedDate = null;
        policeNotifiedFields.policeNotifiedTime = null;
        policeNotifiedFields.policeNotifiedEvent = null;
        policeNotifiedFields.policeNotified = false;
      } else if (updateData.policeNotified === true) {
        // If set to true, process related fields
        policeNotifiedFields.policeNotified = true;
        if (updateData.policeNotifiedDate !== undefined) {
          policeNotifiedFields.policeNotifiedDate = updateData.policeNotifiedDate
            ? new Date(updateData.policeNotifiedDate as any)
            : null;
        }
        if (updateData.policeNotifiedTime !== undefined) {
          policeNotifiedFields.policeNotifiedTime =
            updateData.policeNotifiedTime &&
            updateData.policeNotifiedTime.trim().length > 0
              ? updateData.policeNotifiedTime.trim()
              : null;
        }
        if (updateData.policeNotifiedEvent !== undefined) {
          policeNotifiedFields.policeNotifiedEvent =
            updateData.policeNotifiedEvent &&
            updateData.policeNotifiedEvent.trim().length > 0
              ? updateData.policeNotifiedEvent.trim()
              : null;
        }
      }
    }
    
    // Remove police notified fields and placeIds from updateData to avoid type conflicts
    const { policeNotified, policeNotifiedDate, policeNotifiedTime, policeNotifiedEvent, placeIds, ...restUpdateData } = updateData;
    
    // Si se modificaron fechas, manejar aprobación
    const approvalFields: Partial<Banned> = {};
    if (datesChanged) {
      const oldDates = {
        startingDate: banned.startingDate?.toISOString(),
        endingDate: banned.endingDate?.toISOString(),
      };
      const newDates = {
        startingDate: updateData.startingDate || banned.startingDate?.toISOString(),
        endingDate: updateData.endingDate || banned.endingDate?.toISOString(),
      };

      if (user.role === UserRole.MANAGER) {
        // Manager: requiere aprobación, todos los places vuelven a pending
        approvalFields.requiresApproval = true;
        // Actualizar todos los places existentes a pending
        await this.bannedPlaceRepository.update(
          { bannedId: id },
          { status: BannedPlaceStatus.PENDING, approvedByUserId: null, approvedAt: null }
        );
        
        // Registrar cambio de fechas en historial
        await this.bannedHistoryRepository.save(
          this.bannedHistoryRepository.create({
            bannedId: id,
            banned: banned,
            action: BannedHistoryAction.DATES_CHANGED,
            performedByUserId: userId,
            details: { oldDates, newDates },
          }),
        );
      } else if (user.role === UserRole.HEAD_MANAGER && user.placeId) {
        // Head-manager: aprobar automáticamente sus places
        await this.bannedPlaceRepository.update(
          { bannedId: id, placeId: user.placeId },
          { 
            status: BannedPlaceStatus.APPROVED, 
            approvedByUserId: userId, 
            approvedAt: new Date() 
          }
        );
        // Otros places vuelven a pending si existen
        const allBannedPlaces = await this.bannedPlaceRepository.find({
          where: { bannedId: id },
        });
        const otherPlaces = allBannedPlaces.filter(bp => bp.placeId !== user.placeId);
        if (otherPlaces.length > 0) {
          await this.bannedPlaceRepository.update(
            { bannedId: id, placeId: In(otherPlaces.map(bp => bp.placeId)) },
            { status: BannedPlaceStatus.PENDING, approvedByUserId: null, approvedAt: null }
          );
        }
        
        // Registrar cambio de fechas en historial
        await this.bannedHistoryRepository.save(
          this.bannedHistoryRepository.create({
            bannedId: id,
            banned: banned,
            action: BannedHistoryAction.DATES_CHANGED,
            performedByUserId: userId,
            details: { oldDates, newDates },
          }),
        );
      }
    }
    
    Object.assign(banned, restUpdateData);
    Object.assign(banned, policeNotifiedFields);
    Object.assign(banned, approvalFields);
    banned.lastModifiedByUserId = userId;
    banned.howlong = this.computeHowLong(
      banned.startingDate,
      banned.endingDate,
    );
    const saved = await this.bannedRepository.save(banned);

    // Actualizar places si se proporcionaron placeIds
    if (placeIds !== undefined) {
      // Obtener places existentes
      const existingBannedPlaces = await this.bannedPlaceRepository.find({
        where: { bannedId: saved.id },
      });
      const existingPlaceIds = new Set(existingBannedPlaces.map(bp => bp.placeId));
      const newPlaceIds = new Set(placeIds);
      
      // Eliminar places que ya no están en la lista
      const toDelete = existingBannedPlaces.filter(bp => !newPlaceIds.has(bp.placeId));
      if (toDelete.length > 0) {
        // Registrar eliminación de places en historial
        for (const deletedPlace of toDelete) {
          await this.bannedHistoryRepository.save(
            this.bannedHistoryRepository.create({
              bannedId: saved.id,
              banned: saved,
              action: BannedHistoryAction.PLACE_REMOVED,
              performedByUserId: userId,
              placeId: deletedPlace.placeId,
            }),
          );
        }
        await this.bannedPlaceRepository.delete(
          toDelete.map(bp => ({ bannedId: bp.bannedId, placeId: bp.placeId }))
        );
      }
      
      // Crear nuevas relaciones para places que no existen
      const placesToAdd = placeIds.filter(id => !existingPlaceIds.has(id));
      if (placesToAdd.length > 0) {
        // Verificar que los nuevos places no tengan baneos activos
        const { placesWithActiveBans } = await this.checkActiveBansForPlaces(
          banned.person.id,
          placesToAdd,
        );
        
        const placesWithActiveBansIds = new Set(
          placesWithActiveBans.map((p) => p.placeId),
        );
        const availablePlaceIds = placesToAdd.filter(
          (id) => !placesWithActiveBansIds.has(id),
        );
        
        // Si todos los nuevos places tienen baneos activos, no agregar ninguno
        if (availablePlaceIds.length === 0) {
          // No agregar ningún place nuevo pero continuar con la actualización
          // Registrar en historial que se intentó agregar places con baneos activos
          await this.bannedHistoryRepository.save(
            this.bannedHistoryRepository.create({
              bannedId: saved.id,
              banned: saved,
              action: BannedHistoryAction.PLACE_ADDED,
              performedByUserId: userId,
              details: {
                attemptedPlaceIds: placesToAdd,
                reason: 'Todos los lugares tienen baneos activos que impiden agregarlos',
              },
            }),
          );
        } else {
          // Filtrar places para solo incluir los disponibles
          const places = await this.placeRepository.find({
            where: { id: In(availablePlaceIds) },
          });
          if (places.length !== availablePlaceIds.length) {
            throw new NotFoundException('Some places do not exist');
          }
          const now = new Date();
          const links = places.map((place) => {
          let status = BannedPlaceStatus.PENDING;
          let approvedByUserId: string | null = null;
          let approvedAt: Date | null = null;

          // Si el editor es head-manager y es su propio place, aprobar automáticamente
          // Los managers dejan todos los places (incluido su propio) como pending
          if (user.role === UserRole.HEAD_MANAGER && place.id === user.placeId) {
            status = BannedPlaceStatus.APPROVED;
            approvedByUserId = userId;
            approvedAt = now;
          }
          // Para managers: todos los places quedan pending (incluido su propio place)

          return this.bannedPlaceRepository.create({
            bannedId: saved.id,
            placeId: place.id,
            banned: saved,
            place,
            status,
            approvedByUserId,
            approvedAt,
          });
        });
        await this.bannedPlaceRepository.save(links);

        // Registrar agregado de places en historial
        for (const link of links) {
          await this.bannedHistoryRepository.save(
            this.bannedHistoryRepository.create({
              bannedId: saved.id,
              banned: saved,
              action: BannedHistoryAction.PLACE_ADDED,
              performedByUserId: userId,
              placeId: link.placeId,
              details: {
                status: link.status,
                autoApproved: link.status === BannedPlaceStatus.APPROVED,
              },
            }),
          );
        }
        
        // Registrar lugares filtrados si los hubo
        const filteredPlaceIds = placesToAdd.filter(
          (id) => placesWithActiveBansIds.has(id),
        );
        if (filteredPlaceIds.length > 0) {
          await this.bannedHistoryRepository.save(
            this.bannedHistoryRepository.create({
              bannedId: saved.id,
              banned: saved,
              action: BannedHistoryAction.PLACE_ADDED,
              performedByUserId: userId,
              details: {
                filteredPlaceIds,
                reason: 'Lugares con baneos activos que no pudieron agregarse',
              },
            }),
          );
        }
      }
      }
    }

    // Registrar actualización general si hubo cambios (excepto fechas y places que ya se registraron)
    if (!datesChanged && placeIds === undefined && Object.keys(restUpdateData).length > 0) {
      await this.bannedHistoryRepository.save(
        this.bannedHistoryRepository.create({
          bannedId: saved.id,
          banned: saved,
          action: BannedHistoryAction.UPDATED,
          performedByUserId: userId,
          details: restUpdateData,
        }),
      );
    }

    return saved;
  }

  async remove(id: string, userId: string): Promise<void> {
    // Obtener usuario completo con place
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validar que si es head-manager o manager, tiene placeId
    if (
      (user.role === UserRole.HEAD_MANAGER || user.role === UserRole.MANAGER) &&
      !user.placeId
    ) {
      throw new ForbiddenException('User must have a place assigned to delete bans');
    }

    // Load with relations to ensure existence and provide clear message
    const banned = await this.bannedRepository.findOne({
      where: { id },
      relations: ['bannedPlaces', 'person', 'bannedPlaces.place'],
    });
    if (!banned) throw new NotFoundException('Ban not found');

    // Validar que el ban pertenece a un place del usuario
    if (user.role === UserRole.HEAD_MANAGER || user.role === UserRole.MANAGER) {
      const hasAccess = banned.bannedPlaces?.some(
        (bp) => bp.placeId === user.placeId,
      );
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to delete this ban');
      }
    }

    // With onDelete: 'CASCADE' on BannedPlace.banned, we can allow delete and related bannedPlaces will be removed

    const result = await this.bannedRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Ban not found');
  }

  async approvePlace(
    bannedId: string,
    placeId: string,
    approved: boolean,
    userId: string,
  ): Promise<Banned> {
    // Obtener usuario completo con place
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validar que es head-manager
    if (user.role !== UserRole.HEAD_MANAGER) {
      throw new ForbiddenException('Only head-managers can approve/reject places');
    }

    // Validar que tiene placeId
    if (!user.placeId) {
      throw new ForbiddenException('Head-manager must have a place assigned');
    }

    // Validar que el placeId corresponde al place del head-manager
    if (placeId !== user.placeId) {
      throw new ForbiddenException('You can only approve/reject places from your place');
    }

    // Obtener el ban y el BannedPlace
    const banned = await this.bannedRepository.findOne({
      where: { id: bannedId },
      relations: ['bannedPlaces', 'bannedPlaces.place'],
    });
    if (!banned) {
      throw new NotFoundException('Ban not found');
    }

    const bannedPlace = await this.bannedPlaceRepository.findOne({
      where: { bannedId, placeId },
    });
    if (!bannedPlace) {
      throw new NotFoundException('Place not found in this ban');
    }

    if (approved) {
      // Aprobar: actualizar estado
      bannedPlace.status = BannedPlaceStatus.APPROVED;
      bannedPlace.approvedByUserId = userId;
      bannedPlace.approvedAt = new Date();
      bannedPlace.rejectedByUserId = null;
      bannedPlace.rejectedAt = null;
      await this.bannedPlaceRepository.save(bannedPlace);

      // Registrar aprobación en historial
      await this.bannedHistoryRepository.save(
        this.bannedHistoryRepository.create({
          bannedId,
          banned: banned,
          action: BannedHistoryAction.APPROVED,
          performedByUserId: userId,
          placeId: placeId,
        }),
      );
    } else {
      // Rechazar: eliminar el place del ban
      await this.bannedPlaceRepository.delete({ bannedId, placeId });

      // Registrar rechazo en historial
      await this.bannedHistoryRepository.save(
        this.bannedHistoryRepository.create({
          bannedId,
          banned: banned,
          action: BannedHistoryAction.REJECTED,
          performedByUserId: userId,
          placeId: placeId,
        }),
      );

      return banned;
    }

    return banned;
  }

  async findPendingByManager(userId: string): Promise<Banned[]> {
    // Obtener usuario completo
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Solo managers pueden ver sus bans pendientes
    if (user.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Only managers can view pending bans');
    }

    // Buscar bans creados por el manager que tengan al menos un place pendiente
    return this.bannedRepository
      .createQueryBuilder('banned')
      .leftJoinAndSelect('banned.bannedPlaces', 'bannedPlaces')
      .leftJoinAndSelect('bannedPlaces.place', 'place')
      .leftJoinAndSelect('banned.person', 'person')
      .where('banned.createdByUserId = :userId', { userId })
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('1')
          .from('BannedPlaces', 'bp')
          .where('bp.bannedId = banned.id')
          .andWhere('bp.status = :pendingStatus', {
            pendingStatus: BannedPlaceStatus.PENDING,
          })
          .getQuery();
        return `EXISTS ${subQuery}`;
      })
      .orderBy('banned.startingDate', 'DESC')
      .getMany();
  }

  async findPendingApprovalsByHeadManager(
    userId: string,
    sortBy?: string,
    options?: { page?: number; limit?: number; search?: string },
  ): Promise<{ items: Banned[]; total: number; page: number; limit: number; hasNext: boolean }> {
    // Obtener usuario completo con place
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validar que es head-manager
    if (user.role !== UserRole.HEAD_MANAGER) {
      throw new ForbiddenException('Only head-managers can view approval queue');
    }

    // Validar que tiene placeId
    if (!user.placeId) {
      throw new ForbiddenException('Head-manager must have a place assigned');
    }

    // Función para aplicar sorting
    const applySorting = (queryBuilder: any, sortBy?: string) => {
      const sort = sortBy || 'violations-desc';
      switch (sort) {
        case 'violations-asc':
          queryBuilder.orderBy('banned.violationsCount', 'ASC');
          break;
        case 'starting-date-desc':
          queryBuilder.orderBy('banned.startingDate', 'DESC');
          break;
        case 'starting-date-asc':
          queryBuilder.orderBy('banned.startingDate', 'ASC');
          break;
        case 'ending-date-desc':
          queryBuilder.addOrderBy('CASE WHEN banned.endingDate IS NULL THEN 1 ELSE 0 END', 'ASC')
            .addOrderBy('banned.endingDate', 'DESC');
          break;
        case 'ending-date-asc':
          queryBuilder.addOrderBy('CASE WHEN banned.endingDate IS NULL THEN 1 ELSE 0 END', 'ASC')
            .addOrderBy('banned.endingDate', 'ASC');
          break;
        case 'person-name-asc':
          queryBuilder.orderBy('COALESCE(person.name, \'\') || \' \' || COALESCE(person.lastName, \'\') || \' \' || COALESCE(person.nickname, \'\')', 'ASC');
          break;
        case 'person-name-desc':
          queryBuilder.orderBy('COALESCE(person.name, \'\') || \' \' || COALESCE(person.lastName, \'\') || \' \' || COALESCE(person.nickname, \'\')', 'DESC');
          break;
        case 'violations-desc':
        default:
          queryBuilder.orderBy('banned.violationsCount', 'DESC');
          break;
      }
    };

    // Buscar bans que tengan places pendientes del place del head-manager
    const qb = this.bannedRepository
      .createQueryBuilder('banned')
      .leftJoinAndSelect('banned.bannedPlaces', 'bannedPlaces')
      .leftJoinAndSelect('bannedPlaces.place', 'place')
      .leftJoinAndSelect('banned.person', 'person')
      .leftJoinAndSelect('banned.createdBy', 'createdBy')
      .where('bannedPlaces.placeId = :placeId', { placeId: user.placeId })
      .andWhere('bannedPlaces.status = :pendingStatus', {
        pendingStatus: BannedPlaceStatus.PENDING,
      });

    // Filtro de búsqueda por nombre, apellido, nickname o número de incidente
    if (options?.search && options.search.trim()) {
      const searchTerm = `%${options.search.trim().toLowerCase()}%`;
      const numSearch = options.search.trim().replace(/[^0-9]/g, '');
      if (numSearch.length > 0) {
        // Búsqueda por número de incidente
        qb.andWhere('CAST(banned.incidentNumber AS TEXT) LIKE :numSearch', { numSearch: `%${numSearch}%` });
      } else {
        // Búsqueda por nombre, apellido o nickname
        qb.andWhere(
          '(LOWER(person.name) LIKE :search OR LOWER(person.lastName) LIKE :search OR LOWER(person.nickname) LIKE :search)',
          { search: searchTerm }
        );
      }
    }

    applySorting(qb, sortBy);

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    const hasNext = page * limit < total;

    return { items, total, page, limit, hasNext };
  }

  async getHistory(bannedId: string, userId: string): Promise<BannedHistory[]> {
    // Obtener usuario completo
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verificar que el usuario tiene acceso al ban
    const banned = await this.bannedRepository.findOne({
      where: { id: bannedId },
      relations: ['bannedPlaces', 'bannedPlaces.place'],
    });
    if (!banned) {
      throw new NotFoundException('Ban not found');
    }

    // Validar acceso según rol
    if (
      user.role === UserRole.HEAD_MANAGER ||
      user.role === UserRole.MANAGER ||
      user.role === UserRole.STAFF
    ) {
      if (!user.place?.city) {
        throw new ForbiddenException('User must have a place assigned');
      }

      // Verificar que al menos un place del ban pertenece a la city del usuario
      const hasAccess = banned.bannedPlaces?.some(
        (bp) => bp.place?.city === user.place?.city,
      );
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this ban');
      }
    }

    // Retornar historial ordenado por fecha descendente
    return this.bannedHistoryRepository.find({
      where: { bannedId },
      relations: ['performedBy', 'place'],
      order: { performedAt: 'DESC' },
    });
  }

  async findByPerson(personId: string): Promise<Banned[]> {
    const list = await this.bannedRepository.find({
      where: { person: { id: personId } },
      relations: ['person', 'bannedPlaces'],
      order: { startingDate: 'DESC' },
    });
    return list;
  }

  /**
   * Obtiene estadísticas del historial de baneos de una persona
   */
  async getBanHistoryStats(
    personId: string,
  ): Promise<{
    personId: string;
    totalBans: number;
    activeBansCount: number;
    expiredBansCount: number;
    byPlace: Array<{
      placeId: string;
      placeName: string;
      totalBans: number;
      lastBanDate: Date | null;
    }>;
  }> {
    const now = new Date();
    
    // Obtener todos los baneos de la persona
    const allBans = await this.bannedRepository.find({
      where: { person: { id: personId } },
      relations: ['bannedPlaces', 'bannedPlaces.place'],
      order: { startingDate: 'DESC' },
    });

    // Contar baneos activos y expirados
    const activeBans = allBans.filter((ban) => {
      if (!ban.startingDate) return false;
      return ban.startingDate <= now && (!ban.endingDate || ban.endingDate >= now);
    });
    const expiredBans = allBans.filter((ban) => {
      if (!ban.startingDate) return false;
      return ban.endingDate && ban.endingDate < now;
    });

    // Obtener estadísticas por lugar
    const placeStatsMap = new Map<
      string,
      { placeId: string; placeName: string; totalBans: number; lastBanDate: Date | null }
    >();

    for (const ban of allBans) {
      if (ban.bannedPlaces) {
        for (const bannedPlace of ban.bannedPlaces) {
          if (bannedPlace.status === BannedPlaceStatus.APPROVED) {
            const placeId = bannedPlace.placeId;
            const placeName = bannedPlace.place?.name || placeId;
            
            if (!placeStatsMap.has(placeId)) {
              placeStatsMap.set(placeId, {
                placeId,
                placeName,
                totalBans: 0,
                lastBanDate: null,
              });
            }

            const stats = placeStatsMap.get(placeId)!;
            stats.totalBans++;
            if (!stats.lastBanDate || ban.startingDate > stats.lastBanDate) {
              stats.lastBanDate = ban.startingDate;
            }
          }
        }
      }
    }

    return {
      personId,
      totalBans: allBans.length,
      activeBansCount: activeBans.length,
      expiredBansCount: expiredBans.length,
      byPlace: Array.from(placeStatsMap.values()),
    };
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
