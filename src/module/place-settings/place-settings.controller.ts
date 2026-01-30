import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PlaceSettingsService } from './place-settings.service';
import { UpdatePlaceSettingsDto } from './dto/update-place-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/user.entity';

@Controller('places')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlaceSettingsController {
  constructor(private readonly settingsService: PlaceSettingsService) {}

  @Roles(UserRole.HEAD_MANAGER)
  @Get(':id/settings')
  getSettings(@Param('id') placeId: string, @Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) throw new Error('User ID not found in request');
    return this.settingsService.getSettings(placeId, userId);
  }

  @Roles(UserRole.HEAD_MANAGER)
  @Patch(':id/settings')
  updateSettings(
    @Param('id') placeId: string,
    @Body() dto: UpdatePlaceSettingsDto,
    @Req() req: any,
  ) {
    const userId = (req.user as any)?.userId;
    if (!userId) throw new Error('User ID not found in request');
    return this.settingsService.updateSettings(placeId, dto, userId);
  }

  @Roles(UserRole.MANAGER)
  @Get('available-for-ban')
  getAvailableVenuesForBan(@Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) throw new Error('User ID not found in request');
    return this.settingsService.getAvailableVenuesForBan(userId);
  }

  /**
   * One-time migration to populate PersonPlaceAccess for existing data.
   * Only ADMIN can run this.
   */
  @Roles(UserRole.ADMIN)
  @Post('migrate-person-access')
  migratePersonAccess(@Req() req: any) {
    const userId = (req.user as any)?.userId;
    if (!userId) throw new Error('User ID not found in request');
    return this.settingsService.migrateExistingPersonAccess(userId);
  }
}

