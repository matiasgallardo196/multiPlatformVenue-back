import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Person } from './person.entity';
import { Place } from './place.entity';
import { User } from '../../module/user/user.entity';

export enum PersonAccessType {
  OWNER = 'owner',
  SHARED = 'shared',
}

@Entity('person_place_access')
@Unique(['personId', 'placeId'])
export class PersonPlaceAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  personId: string;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personId' })
  person: Person;

  @Column('uuid')
  placeId: string;

  @ManyToOne(() => Place, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'placeId' })
  place: Place;

  @Column({
    type: 'enum',
    enum: PersonAccessType,
    default: PersonAccessType.OWNER,
  })
  accessType: PersonAccessType;

  @Column('uuid')
  grantedByUserId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'grantedByUserId' })
  grantedBy: User;

  @CreateDateColumn({ type: 'timestamptz' })
  grantedAt: Date;
}
