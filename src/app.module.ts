import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/database.module';
import { PersonModule } from './module/person/person.module';

@Module({
  imports: [DatabaseModule, PersonModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
