import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
  findAll(
    @Query('gender') gender?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    const filters: {
      gender?: 'Male' | 'Female' | null;
      search?: string;
      sortBy?: 'newest-first' | 'oldest-first' | 'name-asc' | 'name-desc';
    } = {};

    if (gender === 'Male' || gender === 'Female') {
      filters.gender = gender;
    } else if (gender === 'null' || gender === '') {
      filters.gender = null;
    }

    if (search) {
      filters.search = search;
    }

    if (sortBy && ['newest-first', 'oldest-first', 'name-asc', 'name-desc'].includes(sortBy)) {
      filters.sortBy = sortBy as 'newest-first' | 'oldest-first' | 'name-asc' | 'name-desc';
    }

    return this.personService.findAll(Object.keys(filters).length > 0 ? filters : undefined);
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
