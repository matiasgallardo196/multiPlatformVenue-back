import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from 'src/shared/entities/incident.entity';
import { Person } from 'src/shared/entities/person.entity';
import { Place } from 'src/shared/entities/place.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';

@Injectable()
export class IncidentService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
  ) {}

  async create(data: CreateIncidentDto): Promise<Incident> {
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

  async findAll(): Promise<Incident[]> {
    return this.incidentRepository.find({
      relations: ['person', 'place', 'banned'],
    });
  }

  async findOne(id: string): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: ['person', 'place', 'banned'],
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  async update(id: string, data: UpdateIncidentDto): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');

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

  async remove(id: string): Promise<void> {
    // Load with relations to decide if it's safe to delete
    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: ['banned'],
    });
    if (!incident) throw new NotFoundException('Incident not found');
    if (incident.banned) {
      throw new ConflictException(
        'Cannot delete this incident because it has a related ban.',
      );
    }
    const result = await this.incidentRepository.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Incident not found');
  }
}
