import { Banned } from './banned.entity';
import { Place } from './place.entity';
import { PrimaryColumn, Entity, ManyToOne, JoinColumn, Column } from 'typeorm';
import { User } from '../../module/user/user.entity';

export enum BannedPlaceStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity({ name: 'BannedPlaces' })
export class BannedPlace {
  @PrimaryColumn('uuid')
  bannedId: string;

  @PrimaryColumn('uuid')
  placeId: string;

  @ManyToOne(() => Banned, (banned) => banned.bannedPlaces, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bannedId' })
  banned: Banned;

  @ManyToOne(() => Place, (place) => place.bannedPlaces)
  @JoinColumn({ name: 'placeId' })
  place: Place;

  @Column({
    type: 'enum',
    enum: BannedPlaceStatus,
    default: BannedPlaceStatus.PENDING,
  })
  status: BannedPlaceStatus;

  @Column({ type: 'uuid', nullable: true })
  approvedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approvedByUserId' })
  approvedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  rejectedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'rejectedByUserId' })
  rejectedBy: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;
}
