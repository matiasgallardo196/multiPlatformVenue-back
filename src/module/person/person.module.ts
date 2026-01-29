import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from 'src/shared/entities/person.entity';
import { Banned } from 'src/shared/entities/banned.entity';
import { PersonPlaceAccess } from 'src/shared/entities/personPlaceAccess.entity';
import { PlaceSettings } from 'src/shared/entities/placeSettings.entity';
import { PersonService } from './person.service';
import { PersonController } from './person.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Person, Banned, PersonPlaceAccess, PlaceSettings]),
    UserModule,
  ],
  controllers: [PersonController],
  providers: [PersonService],
  exports: [PersonService],
})
export class PersonModule {}

