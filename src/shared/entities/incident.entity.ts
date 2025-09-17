import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Place } from './place.entity';
import { Person } from './person.entity';

@Entity({ name: 'Incidents' })
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', array: true, nullable: true })
  photoBook: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  details: string;

  @ManyToOne(() => Place, (place) => place.incidents, { nullable: true })
  @JoinColumn({ name: 'placeId' })
  place: Place;

  @ManyToOne(() => Person, (person) => person.incidents, { nullable: true })
  @JoinColumn({ name: 'personId' })
  person: Person;
}
