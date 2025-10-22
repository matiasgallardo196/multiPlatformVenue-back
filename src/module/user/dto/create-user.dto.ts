import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '../user.entity';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  userName: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(['manager', 'staff', 'head-manager'])
  role: UserRole;
}
