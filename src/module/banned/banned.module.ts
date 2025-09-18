import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Banned } from 'src/shared/entities/banned.entity';
import { Person } from 'src/shared/entities/person.entity';
import { BannedService } from './banned.service';
import { BannedController } from './banned.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Banned, Person])],
  providers: [BannedService],
  controllers: [BannedController],
})
export class BannedModule {}
