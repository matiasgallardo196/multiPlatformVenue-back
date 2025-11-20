import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PlaceService } from './place.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { UserRole } from '../user/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('places')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlaceController {
  constructor(private readonly placeService: PlaceService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() body: CreatePlaceDto) {
    return this.placeService.create(body);
  }

  @Roles(UserRole.STAFF, UserRole.MANAGER)
  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    // Si no se pasan parámetros de paginación, retornar array para compatibilidad
    if (!page && !limit && !search) {
      return this.placeService.findAllSimple();
    }
    const pageNum = Math.max(1, Number(page || '1'));
    const limitNum = Math.min(100, Math.max(1, Number(limit || '20')));
    return this.placeService.findAll({ page: pageNum, limit: limitNum, search: search?.trim() || undefined });
  }

  @Roles(UserRole.STAFF, UserRole.MANAGER)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.placeService.findOne(id);
  }

  @Roles(UserRole.ADMIN, UserRole.HEAD_MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePlaceDto, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.placeService.update(id, body, userId);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.placeService.remove(id);
  }
}
