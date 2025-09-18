import {
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateBannedDto {
  @IsUUID()
  @IsNotEmpty()
  incidentId: string;

  @IsISO8601()
  @IsNotEmpty()
  startingDate: Date | string;

  @IsISO8601()
  @IsNotEmpty()
  endingDate: Date | string;

  @IsString()
  motive?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  placeIds?: string[];
}
