import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Banned } from './banned.entity';
import { User } from '../../module/user/user.entity';
import { Place } from './place.entity';

export enum BannedHistoryAction {
  CREATED = 'created',
  UPDATED = 'updated',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PLACE_ADDED = 'place_added',
  PLACE_REMOVED = 'place_removed',
  DATES_CHANGED = 'dates_changed',
}

@Entity({ name: 'BannedHistory' })
export class BannedHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  bannedId: string;

  @ManyToOne(() => Banned, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bannedId' })
  banned: Banned;

  @Column({
    type: 'enum',
    enum: BannedHistoryAction,
    nullable: false,
  })
  action: BannedHistoryAction;

  @Column({ type: 'uuid', nullable: false })
  performedByUserId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'performedByUserId' })
  performedBy: User;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  performedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  details: any;

  @Column({ type: 'uuid', nullable: true })
  placeId: string | null;

  @ManyToOne(() => Place, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'placeId' })
  place: Place | null;
}



