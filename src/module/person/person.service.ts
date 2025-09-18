import { Injectable, NotFoundException } from '@nestjs/common';
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
      relations: ['incidents', 'banneds'],
    });
  }

  async findOne(id: string): Promise<Person> {
    const person = await this.personRepository.findOne({
      where: { id },
      relations: ['incidents', 'banneds'],
    });
    if (!person) throw new NotFoundException('Persona no encontrada');
    return person;
  }

  async update(id: string, data: UpdatePersonDto): Promise<Person> {
    const person = await this.findOne(id);
    Object.assign(person, data);
    return this.personRepository.save(person);
  }

  async remove(id: string): Promise<void> {
    const result = await this.personRepository.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Persona no encontrada');
  }
}
