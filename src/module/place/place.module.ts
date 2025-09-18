import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Place } from 'src/shared/entities/place.entity';
import { PlaceService } from './place.service';
import { PlaceController } from './place.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Place])],
  providers: [PlaceService],
  controllers: [PlaceController],
})
export class PlaceModule {}
