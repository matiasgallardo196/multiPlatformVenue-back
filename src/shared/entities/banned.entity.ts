import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  JoinColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { Expose } from 'class-transformer';
import { BannedPlace } from './bannedPlace.entity';
import { Person } from './person.entity';

@Entity()
export class Banned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', nullable: false })
  incidentNumber: number;

  @Column({ type: 'timestamptz', nullable: false })
  startingDate: Date;

  @Column({ type: 'timestamptz', nullable: false })
  endingDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  howlong: { years: string; months: string; days: string } | null;

  @Column({ type: 'jsonb', nullable: false })
  motive: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  peopleInvolved: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  incidentReport: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actionTaken: string | null;

  @Column({ type: 'boolean', nullable: false, default: false })
  policeNotified: boolean;

  @Column({ type: 'date', nullable: true })
  policeNotifiedDate: Date | null;

  @Column({ type: 'time', nullable: true })
  policeNotifiedTime: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  policeNotifiedEvent: string | null;

  @Expose()
  get isActive(): boolean {
    if (!this.startingDate) return false;
    const now = new Date();
    if (!this.startingDate) return false;
    if (this.endingDate)
      return this.startingDate <= now && now < this.endingDate;
    return this.startingDate <= now;
  }

  // howlong se persiste como objeto { years, months, days }

  @ManyToOne(() => Person, (person) => person.banneds, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'personId' })
  person: Person;

  @OneToMany(() => BannedPlace, (bannedPlace) => bannedPlace.banned)
  bannedPlaces: BannedPlace[];
}
