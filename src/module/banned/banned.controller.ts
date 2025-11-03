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
import { BannedService } from './banned.service';
import { CreateBannedDto } from './dto/create-banned.dto';
import { UpdateBannedDto } from './dto/update-banned.dto';
import { ApproveBannedPlaceDto } from './dto/approve-banned-place.dto';
import { CheckActiveBansDto } from './dto/check-active-bans.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('banneds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BannedController {
  constructor(private readonly bannedService: BannedService) {}

  @Roles('manager')
  @Post()
  create(@Body() body: CreateBannedDto, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.create(body, userId);
  }

  @Post('check-active')
  checkActiveBans(@Body() body: CheckActiveBansDto) {
    return this.bannedService.checkActiveBansByPersonAndPlaces(
      body.personId,
      body.placeIds,
    );
  }

  @Get()
  findAll(@Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.findAll(userId);
  }

  @Roles('manager')
  @Get('pending')
  findPending(@Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.findPendingByManager(userId);
  }

  @Roles('head-manager')
  @Get('approval-queue')
  findApprovalQueue(@Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.findPendingApprovalsByHeadManager(userId);
  }

  @Get('person/:personId')
  findByPerson(@Param('personId') personId: string) {
    return this.bannedService.findByPerson(personId);
  }

  @Get('person/:personId/stats')
  getBanHistoryStats(@Param('personId') personId: string) {
    return this.bannedService.getBanHistoryStats(personId);
  }

  @Get('person/:personId/active')
  isPersonBanned(@Param('personId') personId: string) {
    return this.bannedService.isPersonBanned(personId);
  }

  @Roles('head-manager')
  @Post(':id/approve')
  approvePlace(
    @Param('id') id: string,
    @Body() body: ApproveBannedPlaceDto,
    @Req() req: any,
  ) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.approvePlace(id, body.placeId, body.approved, userId);
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.getHistory(id, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.findOne(id, userId);
  }

  @Roles('manager')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateBannedDto, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.update(id, body, userId);
  }

  @Roles('manager')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.remove(id, userId);
  }

  @Roles('manager', 'head-manager')
  @Post(':id/violations/increment')
  addViolation(@Param('id') id: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.addViolation(id, userId);
  }
}
