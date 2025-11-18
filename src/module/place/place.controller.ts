import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
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

  @Roles(UserRole.MANAGER)
  @Post()
  create(@Body() body: CreatePlaceDto) {
    return this.placeService.create(body);
  }

  @Roles(UserRole.STAFF)
  @Get()
  findAll() {
    return this.placeService.findAll();
  }

  @Roles(UserRole.STAFF)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.placeService.findOne(id);
  }

  @Roles(UserRole.MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePlaceDto) {
    return this.placeService.update(id, body);
  }

  @Roles(UserRole.MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.placeService.remove(id);
  }
}
