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
import { IncidentService } from './incident.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';

@Controller('incidents')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Roles('manager')
  @Post()
  create(@Body() body: CreateIncidentDto) {
    return this.incidentService.create(body);
  }

  @Get()
  findAll() {
    return this.incidentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.incidentService.findOne(id);
  }

  @Roles('manager')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateIncidentDto) {
    return this.incidentService.update(id, body);
  }

  @Roles('manager')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.incidentService.remove(id);
  }
}
