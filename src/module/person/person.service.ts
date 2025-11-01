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

  async create(data: CreatePersonDto): Promise<Person> {
    const person = this.personRepository.create(data);
    return this.personRepository.save(person);
  }

  async findAll(): Promise<Person[]> {
    return this.personRepository.find({
      relations: ['incidents'],
    });
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
    Object.assign(person, data);
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
