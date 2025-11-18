import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place } from 'src/shared/entities/place.entity';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/user.entity';

@Injectable()
export class PlaceService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
    private readonly userService: UserService,
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

  async update(id: string, data: UpdatePlaceDto, userId: string): Promise<Place> {
    const place = await this.findOne(id);
    
    // Obtener usuario para validar permisos
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // HEAD_MANAGER solo puede modificar placeEmail
    if (user.role === UserRole.HEAD_MANAGER) {
      if (data.name !== undefined || data.city !== undefined) {
        throw new ForbiddenException('Head manager can only modify place email');
      }
      // Solo permitir modificar placeEmail
      if (data.placeEmail !== undefined) {
        place.placeEmail = data.placeEmail;
      }
    } else if (user.role === UserRole.ADMIN) {
      // ADMIN puede modificar todos los campos
      Object.assign(place, data);
    } else {
      throw new ForbiddenException('Only admin or head-manager can update places');
    }

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
