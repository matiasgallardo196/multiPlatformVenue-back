import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaceSettings } from '../../shared/entities/placeSettings.entity';
import { PersonPlaceAccess } from '../../shared/entities/personPlaceAccess.entity';
import { Place } from '../../shared/entities/place.entity';
import { PlaceSettingsService } from './place-settings.service';
import { PlaceSettingsController } from './place-settings.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlaceSettings, PersonPlaceAccess, Place]),
    UserModule,
  ],
  controllers: [PlaceSettingsController],
  providers: [PlaceSettingsService],
  exports: [PlaceSettingsService],
})
export class PlaceSettingsModule {}
