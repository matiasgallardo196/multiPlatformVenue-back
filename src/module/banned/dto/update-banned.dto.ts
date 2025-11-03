import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class UpdateBannedDto {
  @IsNumber()
  @IsInt()
  @IsOptional()
  incidentNumber?: number;

  @IsISO8601()
  @IsOptional()
  startingDate?: Date | string;

  @IsISO8601()
  @IsOptional()
  endingDate?: Date | string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  motive?: string[];

  @IsString()
  @IsOptional()
  peopleInvolved?: string | null;

  @IsString()
  @IsOptional()
  incidentReport?: string | null;

  @IsString()
  @IsOptional()
  actionTaken?: string | null;

  @IsBoolean()
  @IsOptional()
  policeNotified?: boolean;

  @ValidateIf((o) => o.policeNotified === true)
  @IsDateString()
  @IsOptional()
  policeNotifiedDate?: string | null;

  @ValidateIf((o) => o.policeNotified === true)
  @IsString()
  @IsOptional()
  policeNotifiedTime?: string | null;

  @ValidateIf((o) => o.policeNotified === true)
  @IsString()
  @IsOptional()
  policeNotifiedEvent?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  placeIds?: string[];
}
