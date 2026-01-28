import { IsArray, IsIn, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class BulkApproveDto {
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  placeIds?: string[];

  @IsOptional()
  @IsIn(['Male', 'Female'])
  gender?: 'Male' | 'Female';

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  bannedIds?: string[];

  @IsOptional()
  @Min(1)
  @Max(5000)
  maxBatchSize?: number;
}


