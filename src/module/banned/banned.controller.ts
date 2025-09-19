import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { BannedService } from './banned.service';
import { CreateBannedDto } from './dto/create-banned.dto';
import { UpdateBannedDto } from './dto/update-banned.dto';

@Controller('banneds')
export class BannedController {
  constructor(private readonly bannedService: BannedService) {}

  @Roles('manager')
  @Post()
  create(@Body() body: CreateBannedDto) {
    return this.bannedService.create(body);
  }

  @Get()
  findAll() {
    return this.bannedService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bannedService.findOne(id);
  }

  @Roles('manager')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateBannedDto) {
    return this.bannedService.update(id, body);
  }

  @Roles('manager')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bannedService.remove(id);
  }

  @Get('person/:personId')
  findByPerson(@Param('personId') personId: string) {
    return this.bannedService.findByPerson(personId);
  }

  @Get('person/:personId/active')
  isPersonBanned(@Param('personId') personId: string) {
    return this.bannedService.isPersonBanned(personId);
  }
}
