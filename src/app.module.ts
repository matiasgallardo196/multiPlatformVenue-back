import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/database.module';
import { PersonModule } from './module/person/person.module';
import { BannedModule } from './module/banned/banned.module';
import { IncidentModule } from './module/incident/incident.module';
import { PlaceModule } from './module/place/place.module';
import { CloudinaryModule } from './module/cloudinary/cloudinary.module';

@Module({
  imports: [
    DatabaseModule,
    PersonModule,
    BannedModule,
    IncidentModule,
    PlaceModule,
    CloudinaryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
