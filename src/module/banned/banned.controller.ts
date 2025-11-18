import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { BannedService } from './banned.service';
import { CreateBannedDto } from './dto/create-banned.dto';
import { UpdateBannedDto } from './dto/update-banned.dto';
import { ApproveBannedPlaceDto } from './dto/approve-banned-place.dto';
import { BulkApproveBannedDto } from './dto/bulk-approve-banned.dto';
import { CheckActiveBansDto } from './dto/check-active-bans.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../user/user.entity';

@Controller('banneds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BannedController {
  constructor(private readonly bannedService: BannedService) {}

  @Roles(UserRole.MANAGER)
  @Post()
  create(@Body() body: CreateBannedDto, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.create(body, userId);
  }

  @Roles(UserRole.MANAGER)
  @Post('check-active')
  checkActiveBans(@Body() body: CheckActiveBansDto) {
    return this.bannedService.checkActiveBansByPersonAndPlaces(
      body.personId,
      body.placeIds,
    );
  }

  @Roles(UserRole.MANAGER)
  @Get()
  findAll(@Req() req: any, @Query('sortBy') sortBy?: string) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.findAll(userId, sortBy);
  }

  @Roles(UserRole.MANAGER)
  @Get('pending')
  findPending(@Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.findPendingByManager(userId);
  }

  @Roles(UserRole.HEAD_MANAGER)
  @Get('approval-queue')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  findApprovalQueue(@Req() req: any, @Query('sortBy') sortBy?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    const pageNum = Math.max(1, Number(page || '1'));
    const limitNum = Math.min(100, Math.max(1, Number(limit || '20')));
    return this.bannedService.findPendingApprovalsByHeadManager(userId, sortBy, { page: pageNum, limit: limitNum, search: search?.trim() || undefined });
  }

  @Roles(UserRole.MANAGER)
  @Get('person/:personId')
  findByPerson(@Param('personId') personId: string) {
    return this.bannedService.findByPerson(personId);
  }

  @Roles(UserRole.MANAGER)
  @Get('person/:personId/stats')
  getBanHistoryStats(@Param('personId') personId: string) {
    return this.bannedService.getBanHistoryStats(personId);
  }

  @Roles(UserRole.MANAGER)
  @Get('person/:personId/active')
  isPersonBanned(@Param('personId') personId: string) {
    return this.bannedService.isPersonBanned(personId);
  }

  @Roles(UserRole.HEAD_MANAGER)
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

  @Roles(UserRole.HEAD_MANAGER)
  @Post('approve/bulk')
  bulkApprovePlaces(@Body() body: BulkApproveBannedDto, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.bulkApprovePlaces(userId, body);
  }

  @Roles(UserRole.MANAGER)
  @Get(':id/history')
  getHistory(@Param('id') id: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.getHistory(id, userId);
  }

  @Roles(UserRole.MANAGER)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.findOne(id, userId);
  }

  @Roles(UserRole.MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateBannedDto, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.update(id, body, userId);
  }

  @Roles(UserRole.MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.remove(id, userId);
  }

  @Roles(UserRole.MANAGER, UserRole.HEAD_MANAGER)
  @Post(':id/violations/increment')
  addViolation(@Param('id') id: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.bannedService.addViolation(id, userId);
  }
}
