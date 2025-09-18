import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpdateBannedDto {
  @IsISO8601()
  @IsOptional()
  startingDate?: Date | string;

  @IsISO8601()
  @IsOptional()
  endingDate?: Date | string | null;

  @IsString()
  @IsOptional()
  motive?: string;
}
