import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Person } from './person.entity';
import { Place } from './place.entity';

export enum PersonHistoryAction {
  CREATED = 'created',
  UPDATED = 'updated',
  SHARED = 'shared',
  UNSHARED = 'unshared',
  ACCESS_REMOVED = 'access_removed',
  OWNERSHIP_TRANSFERRED = 'ownership_transferred',
}

@Entity('person_history')
export class PersonHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  personId: string;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personId' })
  person: Person;

  @Column({
    type: 'enum',
    enum: PersonHistoryAction,
  })
  action: PersonHistoryAction;

  @Column('uuid')
  performedByUserId: string;

  @CreateDateColumn()
  performedAt: Date;

  @Column('uuid', { nullable: true })
  placeId: string | null;

  @ManyToOne(() => Place, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'placeId' })
  place: Place | null;

  @Column('jsonb', { nullable: true })
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[] | null;

  @Column('text', { nullable: true })
  notes: string | null;
}
