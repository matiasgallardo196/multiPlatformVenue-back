import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Expose } from 'class-transformer';
import { BannedPlace } from './bannedPlace.entity';
import { Incident } from './incident.entity';

@Entity()
export class Banned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz', nullable: false })
  startingDate: Date;

  @Column({ type: 'timestamptz', nullable: false })
  endingDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  howlong: { years: string; months: string; days: string } | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motive: string;

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

  @OneToOne(() => Incident, (incident) => incident.banned, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'incidentId' })
  incident: Incident;

  @OneToMany(() => BannedPlace, (bannedPlace) => bannedPlace.banned)
  bannedPlaces: BannedPlace[];
}
