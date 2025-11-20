import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from 'src/shared/entities/person.entity';
import { Place } from 'src/shared/entities/place.entity';
import { Banned } from 'src/shared/entities/banned.entity';
import { BannedPlace } from 'src/shared/entities/bannedPlace.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Person, Place, Banned, BannedPlace, User])],
  controllers: [DashboardController],
  providers: [UserService],
})
export class DashboardModule {}





