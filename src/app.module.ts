import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/database.module';
import { PersonModule } from './module/person/person.module';
import { BannedModule } from './module/banned/banned.module';

@Module({
  imports: [DatabaseModule, PersonModule, BannedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
