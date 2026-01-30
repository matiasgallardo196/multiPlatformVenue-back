import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Place } from './place.entity';

@Entity('place_settings')
export class PlaceSettings {
  @PrimaryColumn('uuid')
  placeId: string;

  @ManyToOne(() => Place, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'placeId' })
  place: Place;

  // Accept ban requests from other venues?
  @Column({ type: 'boolean', default: false })
  acceptExternalBans: boolean;

  // From which venues (REQUIRED if acceptExternalBans=true)
  @Column({ type: 'uuid', array: true, default: [] })
  acceptBansFromPlaceIds: string[];

  // Share person database?
  @Column({ type: 'boolean', default: false })
  sharePersons: boolean;

  // With which venues (REQUIRED if sharePersons=true)
  @Column({ type: 'uuid', array: true, default: [] })
  sharePersonsWithPlaceIds: string[];

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
