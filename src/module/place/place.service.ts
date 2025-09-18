import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place } from 'src/shared/entities/place.entity';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';

@Injectable()
export class PlaceService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
  ) {}

  async create(data: CreatePlaceDto): Promise<Place> {
    const place = this.placeRepository.create(data);
    return this.placeRepository.save(place);
  }

  async findAll(): Promise<Place[]> {
    return this.placeRepository.find({
      relations: ['incidents', 'bannedPlaces'],
    });
  }

  async findOne(id: string): Promise<Place> {
    const place = await this.placeRepository.findOne({
      where: { id },
      relations: ['incidents', 'bannedPlaces'],
    });
    if (!place) throw new NotFoundException('Lugar no encontrado');
    return place;
  }

  async update(id: string, data: UpdatePlaceDto): Promise<Place> {
    const place = await this.findOne(id);
    Object.assign(place, data);
    return this.placeRepository.save(place);
  }

  async remove(id: string): Promise<void> {
    const result = await this.placeRepository.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Lugar no encontrado');
  }
}
