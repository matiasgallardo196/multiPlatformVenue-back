import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreatePersonDto {
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
}
