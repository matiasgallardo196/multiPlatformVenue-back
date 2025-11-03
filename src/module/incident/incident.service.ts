import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from 'src/shared/entities/incident.entity';
import { Person } from 'src/shared/entities/person.entity';
import { Place } from 'src/shared/entities/place.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/user.entity';

@Injectable()
export class IncidentService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
    private readonly userService: UserService,
  ) {}

  async create(data: CreateIncidentDto, userId: string): Promise<Incident> {
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
      throw new ForbiddenException('User must have a place assigned to create incidents');
    }

    // Validar que el placeId pertenece al place del usuario
    if (data.placeId) {
      if (user.role === UserRole.HEAD_MANAGER || user.role === UserRole.MANAGER) {
        if (data.placeId !== user.placeId) {
          throw new ForbiddenException('Cannot create incident for place outside your place');
        }
      }
    }

    let person: Person | undefined;
    let place: Place | undefined;
    if (data.personId) {
      const personEntity = await this.personRepository.findOne({
        where: { id: data.personId },
      });
      if (!personEntity) throw new NotFoundException('Person not found');
      person = personEntity;
    }
    if (data.placeId) {
      const placeEntity = await this.placeRepository.findOne({
        where: { id: data.placeId },
      });
      if (!placeEntity) throw new NotFoundException('Place not found');
      place = placeEntity;
    }

    const incident = this.incidentRepository.create({
      details: data.details,
      photoBook: data.photoBook,
      person,
      place,
    });
    return this.incidentRepository.save(incident);
  }

  async findAll(userId: string): Promise<Incident[]> {
    // Obtener usuario completo con place
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Si es head-manager, manager o staff, filtrar por city
    if (
      user.role === UserRole.HEAD_MANAGER ||
      user.role === UserRole.MANAGER ||
      user.role === UserRole.STAFF
    ) {
      if (!user.place?.city) {
        // Si no tiene city, retornar lista vacía
        return [];
      }

      // Filtrar incidents donde place.city = user.place.city
      return this.incidentRepository.find({
        where: { place: { city: user.place.city } },
        relations: ['person', 'place'],
      });
    }

    // Para otros roles (admin, editor, viewer), retornar todos
    return this.incidentRepository.find({
      relations: ['person', 'place'],
    });
  }

  async findOne(id: string, userId: string): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: ['person', 'place'],
    });
    if (!incident) throw new NotFoundException('Incident not found');

    // Obtener usuario completo con place
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Si es head-manager, manager o staff, validar que el incident pertenece a su city
    if (
      user.role === UserRole.HEAD_MANAGER ||
      user.role === UserRole.MANAGER ||
      user.role === UserRole.STAFF
    ) {
      if (!user.place?.city) {
        throw new ForbiddenException('User must have a place assigned');
      }

      // Verificar que el place del incident pertenece a la city del usuario
      if (!incident.place || incident.place.city !== user.place.city) {
        throw new ForbiddenException('You do not have access to this incident');
      }
    }

    return incident;
  }

  async update(id: string, data: UpdateIncidentDto, userId: string): Promise<Incident> {
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
      throw new ForbiddenException('User must have a place assigned to update incidents');
    }

    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: ['place'],
    });
    if (!incident) throw new NotFoundException('Incident not found');

    // Validar que el incident pertenece a un place del usuario
    if (user.role === UserRole.HEAD_MANAGER || user.role === UserRole.MANAGER) {
      if (!incident.place || incident.place.id !== user.placeId) {
        throw new ForbiddenException('You do not have access to update this incident');
      }
    }

    // Validar nuevo placeId si se está actualizando
    if (data.placeId) {
      if (user.role === UserRole.HEAD_MANAGER || user.role === UserRole.MANAGER) {
        if (data.placeId !== user.placeId) {
          throw new ForbiddenException('Cannot update incident with place outside your place');
        }
      }
    }

    if (data.personId) {
      const person = await this.personRepository.findOne({
        where: { id: data.personId },
      });
      if (!person) throw new NotFoundException('Person not found');
      incident.person = person;
    }
    if (data.placeId) {
      const place = await this.placeRepository.findOne({
        where: { id: data.placeId },
      });
      if (!place) throw new NotFoundException('Place not found');
      incident.place = place;
    }

    if (data.details !== undefined) incident.details = data.details;
    if (data.photoBook !== undefined) incident.photoBook = data.photoBook;

    return this.incidentRepository.save(incident);
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
      throw new ForbiddenException('User must have a place assigned to delete incidents');
    }

    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: ['place'],
    });
    if (!incident) throw new NotFoundException('Incident not found');

    // Validar que el incident pertenece a un place del usuario
    if (user.role === UserRole.HEAD_MANAGER || user.role === UserRole.MANAGER) {
      if (!incident.place || incident.place.id !== user.placeId) {
        throw new ForbiddenException('You do not have access to delete this incident');
      }
    }

    const result = await this.incidentRepository.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Incident not found');
  }
}
