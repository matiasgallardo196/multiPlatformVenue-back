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
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { IncidentService } from './incident.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Roles('manager')
  @Post()
  create(@Body() body: CreateIncidentDto, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.incidentService.create(body, userId);
  }

  @Get()
  findAll(@Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.incidentService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.incidentService.findOne(id, userId);
  }

  @Roles('manager')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateIncidentDto, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.incidentService.update(id, body, userId);
  }

  @Roles('manager')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.incidentService.remove(id, userId);
  }
}
