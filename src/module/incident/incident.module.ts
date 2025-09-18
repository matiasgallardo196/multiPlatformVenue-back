import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from 'src/shared/entities/incident.entity';
import { Person } from 'src/shared/entities/person.entity';
import { Place } from 'src/shared/entities/place.entity';
import { IncidentService } from './incident.service';
import { IncidentController } from './incident.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Incident, Person, Place])],
  providers: [IncidentService],
  controllers: [IncidentController],
})
export class IncidentModule {}
