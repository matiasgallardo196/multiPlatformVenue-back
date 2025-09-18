import { IsISO8601, IsNotEmpty, IsString, IsUUID } from 'class-validator';

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
}
