import { IsEmail, IsEnum, IsString, MinLength, IsUUID, IsOptional } from 'class-validator';
import { UserRole } from '../user.entity';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  userName: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsUUID()
  @IsOptional()
  placeId?: string;
}
