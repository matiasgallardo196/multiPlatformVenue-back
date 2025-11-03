import { IsUUID, IsBoolean, IsNotEmpty } from 'class-validator';

export class ApproveBannedPlaceDto {
  @IsUUID()
  @IsNotEmpty()
  placeId: string;

  @IsBoolean()
  @IsNotEmpty()
  approved: boolean;
}


