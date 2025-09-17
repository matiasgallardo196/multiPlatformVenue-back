import { Banned } from './banned.entity';
import { Place } from './place.entity';
import { PrimaryColumn, Entity, ManyToOne, JoinColumn } from 'typeorm';

@Entity({ name: 'BannedPlaces' })
export class BannedPlace {
  @PrimaryColumn('uuid')
  bannedId: string;

  @PrimaryColumn('uuid')
  placeId: string;

  @ManyToOne(() => Banned, (banned) => banned.bannedPlaces)
  @JoinColumn({ name: 'bannedId' })
  banned: Banned;

  @ManyToOne(() => Place, (place) => place.bannedPlaces)
  @JoinColumn({ name: 'placeId' })
  place: Place;
}
