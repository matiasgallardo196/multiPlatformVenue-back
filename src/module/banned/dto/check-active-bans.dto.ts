import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class CheckActiveBansDto {
  @IsUUID()
  @IsNotEmpty()
  personId: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  placeIds: string[];
}

