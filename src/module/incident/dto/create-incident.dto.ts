import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateIncidentDto {
  @IsUUID()
  @IsNotEmpty()
  personId: string;

  @IsUUID()
  @IsNotEmpty()
  placeId: string;

  @IsString()
  @IsOptional()
  details?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photoBook?: string[];
}
