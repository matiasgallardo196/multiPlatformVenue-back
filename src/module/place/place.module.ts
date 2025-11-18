import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Place } from 'src/shared/entities/place.entity';
import { PlaceService } from './place.service';
import { PlaceController } from './place.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Place]),
    UserModule,
  ],
  providers: [PlaceService],
  controllers: [PlaceController],
})
export class PlaceModule {}
