import { IsOptional, IsString } from 'class-validator';

export class UpdatePlaceDto {
  @IsOptional()
  @IsString()
  name?: string;
}
