import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Person } from './person.entity';
import { BannedPlace } from './bannedPlace.entity';

@Entity()
export class Banned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz', nullable: true })
  startingDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endingDate: Date;

  @Column({ type: 'text', array: true, nullable: true })
  howlong: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  motive: string;

  @ManyToOne(() => Person, (person) => person.banneds, { nullable: true })
  @JoinColumn({ name: 'personId' })
  person: Person;

  @OneToMany(() => BannedPlace, (bannedPlace) => bannedPlace.banned)
  bannedPlaces: BannedPlace[];
}
