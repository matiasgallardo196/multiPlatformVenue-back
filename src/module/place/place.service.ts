import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
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
      relations: ['bannedPlaces'],
    });
  }

  async findOne(id: string): Promise<Place> {
    const place = await this.placeRepository.findOne({
      where: { id },
      relations: ['bannedPlaces'],
    });
    if (!place) throw new NotFoundException('Place not found');
    return place;
  }

  async update(id: string, data: UpdatePlaceDto): Promise<Place> {
    const place = await this.findOne(id);
    Object.assign(place, data);
    return this.placeRepository.save(place);
  }

  async remove(id: string): Promise<void> {
    // Check related entities to provide descriptive errors
    const place = await this.placeRepository.findOne({
      where: { id },
      relations: ['bannedPlaces'],
    });
    if (!place) throw new NotFoundException('Place not found');

    const hasBans = (place.bannedPlaces?.length || 0) > 0;
    if (hasBans) {
      throw new ConflictException('Cannot delete this place because it has related bans.');
    }

    const result = await this.placeRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Place not found');
  }
}
