import { IsOptional, IsUUID, IsEnum, IsArray, IsInt, Min, Max } from 'class-validator';

export class BulkApproveBannedDto {
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @IsOptional()
  @IsEnum(['Male', 'Female'])
  gender?: 'Male' | 'Female';

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  bannedIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  placeIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxBatchSize?: number;
}

