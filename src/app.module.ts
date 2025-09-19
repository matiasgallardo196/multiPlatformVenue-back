import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/database.module';
import { PersonModule } from './module/person/person.module';
import { BannedModule } from './module/banned/banned.module';
import { IncidentModule } from './module/incident/incident.module';
import { PlaceModule } from './module/place/place.module';
import { CloudinaryModule } from './module/cloudinary/cloudinary.module';
import { AuthModule } from './module/auth/auth.module';
import { UserModule } from './module/user/user.module';
import { JwtAuthGuard } from './module/auth/jwt-auth.guard';
import { RolesGuard } from './module/auth/roles.guard';

@Module({
  imports: [
    DatabaseModule,
    PersonModule,
    BannedModule,
    IncidentModule,
    PlaceModule,
    CloudinaryModule,
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
