import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findByUserName(userName: string) {
    return this.repo.findOne({ where: { userName } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(userName: string, passwordHash: string, role: string) {
    const user = this.repo.create({
      userName,
      passwordHash,
      role: role as any,
    });
    return this.repo.save(user);
  }
}
