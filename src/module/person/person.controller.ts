import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PersonService } from './person.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

@Controller('persons')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @Roles('manager')
  @Post()
  create(@Body() body: CreatePersonDto) {
    return this.personService.create(body);
  }

  @Get()
  findAll() {
    return this.personService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.personService.findOne(id);
  }

  @Roles('manager')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePersonDto) {
    return this.personService.update(id, body);
  }

  @Roles('manager')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.personService.remove(id);
  }
}
