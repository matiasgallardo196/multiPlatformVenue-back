import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Banned } from 'src/shared/entities/banned.entity';
import { Incident } from 'src/shared/entities/incident.entity';
import { BannedPlace } from 'src/shared/entities/bannedPlace.entity';
import { Place } from 'src/shared/entities/place.entity';
import { BannedService } from './banned.service';
import { BannedController } from './banned.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Banned, Incident, BannedPlace, Place])],
  providers: [BannedService],
  controllers: [BannedController],
})
export class BannedModule {}
