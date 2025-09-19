import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePersonDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagenProfileUrl?: string[];

  @IsOptional()
  @IsIn(['Male', 'Female'])
  gender?: 'Male' | 'Female';
}
