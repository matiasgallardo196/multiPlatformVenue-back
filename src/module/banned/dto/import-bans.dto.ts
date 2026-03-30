import { IsUUID, IsEnum, IsOptional } from 'class-validator';

export enum ImportBansFilter {
  ACTIVE_ONLY = 'active_only',
  ALL = 'all',
}

export class ImportBansDto {
  @IsUUID()
  sourcePlaceId: string;

  @IsUUID()
  targetPlaceId: string;

  @IsOptional()
  @IsEnum(ImportBansFilter)
  filter?: ImportBansFilter; // default: active_only
}
