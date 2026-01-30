import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from 'src/shared/entities/person.entity';
import { Banned } from 'src/shared/entities/banned.entity';
import { PersonPlaceAccess } from 'src/shared/entities/personPlaceAccess.entity';
import { PlaceSettings } from 'src/shared/entities/placeSettings.entity';
import { PersonHistory } from 'src/shared/entities/personHistory.entity';
import { Place } from 'src/shared/entities/place.entity';
import { PersonService } from './person.service';
import { PersonController } from './person.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Person, Banned, PersonPlaceAccess, PlaceSettings, PersonHistory, Place]),
    UserModule,
  ],
  controllers: [PersonController],
  providers: [PersonService],
  exports: [PersonService],
})
export class PersonModule {}


