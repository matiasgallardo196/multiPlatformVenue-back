import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Incident } from './incident.entity';
import { BannedPlace } from './bannedPlace.entity';

@Entity({ name: 'Places' })
export class Place {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @OneToMany(() => Incident, (incident) => incident.place)
  incidents: Incident[];

  @OneToMany(() => BannedPlace, (bannedPlace) => bannedPlace.place)
  bannedPlaces: BannedPlace[];
}
