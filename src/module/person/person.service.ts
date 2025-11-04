import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from 'src/shared/entities/person.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

@Injectable()
export class PersonService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
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
    // Color de fondo por género (tonos más fuertes)
    // Male: azul intenso | Female: rosa intenso
    const bg = gender === 'Male' ? '3b82f6' : gender === 'Female' ? 'ec4899' : '9ca3af';
    return `https://api.dicebear.com/7.x/initials/svg?seed=${safeSeed}&radius=50&fontFamily=Arial&fontWeight=700&backgroundColor=${bg}`;
  }

  async create(data: CreatePersonDto): Promise<Person> {
    const normalized = this.normalizeNames(data);
    // If no images provided, set a default DiceBear avatar with initials
    if (!normalized.imagenProfileUrl || normalized.imagenProfileUrl.length === 0) {
      const initials = this.getInitials(normalized.name, normalized.lastName, normalized.nickname);
      if (initials) {
        normalized.imagenProfileUrl = [this.generateDiceBearUrl(initials, normalized.gender as any)];
      }
    }
    const person = this.personRepository.create(normalized);
    return this.personRepository.save(person);
  }

  async findAll(filters?: {
    gender?: 'Male' | 'Female' | null;
    search?: string;
    sortBy?: 'newest-first' | 'oldest-first' | 'name-asc' | 'name-desc';
  }): Promise<Person[]> {
    const queryBuilder = this.personRepository.createQueryBuilder('person')
      .leftJoinAndSelect('person.incidents', 'incidents');

    // Filtro por género
    if (filters?.gender !== undefined && filters.gender !== null) {
      queryBuilder.andWhere('person.gender = :gender', { gender: filters.gender });
    }

    // Filtro por búsqueda (nombre, apellido, nickname)
    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim().toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(person.name) LIKE :search OR LOWER(person.lastName) LIKE :search OR LOWER(person.nickname) LIKE :search)',
        { search: searchTerm }
      );
    }

    // Ordenamiento
    const sortBy = filters?.sortBy || 'newest-first';
    switch (sortBy) {
      case 'oldest-first':
        queryBuilder.orderBy('person.createdAt', 'ASC');
        break;
      case 'name-asc':
        // Ordenar por nombre completo (nombre + apellido), usando COALESCE para manejar NULLs
        queryBuilder.orderBy('COALESCE(person.name, \'\') || \' \' || COALESCE(person.lastName, \'\') || \' \' || COALESCE(person.nickname, \'\')', 'ASC');
        break;
      case 'name-desc':
        // Ordenar por nombre completo (nombre + apellido), usando COALESCE para manejar NULLs
        queryBuilder.orderBy('COALESCE(person.name, \'\') || \' \' || COALESCE(person.lastName, \'\') || \' \' || COALESCE(person.nickname, \'\')', 'DESC');
        break;
      case 'newest-first':
      default:
        queryBuilder.orderBy('person.createdAt', 'DESC');
        break;
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<Person> {
    const person = await this.personRepository.findOne({
      where: { id },
      relations: ['incidents'],
    });
    if (!person) throw new NotFoundException('Person not found');
    return person;
  }

  async update(id: string, data: UpdatePersonDto): Promise<Person> {
    const person = await this.findOne(id);
    const normalized = this.normalizeNames(data);
    Object.assign(person, normalized);
    return this.personRepository.save(person);
  }

  async remove(id: string): Promise<void> {
    // Load with relations to provide descriptive error if there are incidents
    const person = await this.personRepository.findOne({
      where: { id },
      relations: ['incidents'],
    });
    if (!person) throw new NotFoundException('Person not found');

    const hasIncidents = (person.incidents?.length || 0) > 0;
    if (hasIncidents) {
      throw new ConflictException(
        'Cannot delete this person because they have related incidents.',
      );
    }

    const result = await this.personRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Person not found');
  }
}
