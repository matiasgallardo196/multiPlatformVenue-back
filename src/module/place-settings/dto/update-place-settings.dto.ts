import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdatePlaceSettingsDto {
  @IsOptional()
  @IsBoolean()
  acceptExternalBans?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  acceptBansFromPlaceIds?: string[];

  @IsOptional()
  @IsBoolean()
  sharePersons?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  sharePersonsWithPlaceIds?: string[];
}
