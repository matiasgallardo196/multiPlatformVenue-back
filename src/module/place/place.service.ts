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

  async findAll(
    options?: { page?: number; limit?: number; search?: string },
  ): Promise<{ items: Place[]; total: number; page: number; limit: number; hasNext: boolean }> {
    const qb = this.placeRepository
      .createQueryBuilder('place')
      .leftJoinAndSelect('place.bannedPlaces', 'bannedPlaces');

    // Filtro de búsqueda por nombre o ciudad
    if (options?.search && options.search.trim()) {
      const searchTerm = `%${options.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(place.name) LIKE :search OR LOWER(place.city) LIKE :search)',
        { search: searchTerm }
      );
    }

    // Ordenamiento por defecto: nombre ascendente
    qb.orderBy('place.name', 'ASC');

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    const hasNext = page * limit < total;

    return { items, total, page, limit, hasNext };
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
