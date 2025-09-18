import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateIncidentDto {
  @IsUUID()
  @IsOptional()
  personId?: string;

  @IsUUID()
  @IsOptional()
  placeId?: string;

  @IsString()
  @IsOptional()
  details?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photoBook?: string[];
}
