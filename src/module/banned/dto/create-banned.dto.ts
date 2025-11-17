import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateBannedDto {
  @IsUUID()
  @IsNotEmpty()
  personId: string;

  @IsNumber()
  @IsInt()
  @IsNotEmpty()
  incidentNumber: number;

  @IsISO8601()
  @IsNotEmpty()
  startingDate: Date | string;

  @IsISO8601()
  @IsNotEmpty()
  endingDate: Date | string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  motive: string[];

  @IsString()
  @IsOptional()
  peopleInvolved?: string;

  @IsString()
  @IsNotEmpty()
  incidentReport: string;

  @IsString()
  @IsOptional()
  actionTaken?: string;

  @IsBoolean()
  @IsNotEmpty()
  policeNotified: boolean;

  @ValidateIf((o) => o.policeNotified === true)
  @IsDateString()
  @IsNotEmpty()
  policeNotifiedDate?: string;

  @ValidateIf((o) => o.policeNotified === true)
  @IsString()
  @IsNotEmpty()
  policeNotifiedTime?: string;

  @ValidateIf((o) => o.policeNotified === true)
  @IsString()
  @IsNotEmpty()
  policeNotifiedEvent?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  placeIds: string[];
}
