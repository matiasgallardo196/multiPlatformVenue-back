import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { BannedPlace } from './bannedPlace.entity';

@Entity({ name: 'Places' })
export class Place {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  city: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  placeEmail: string;

  @OneToMany(() => BannedPlace, (bannedPlace) => bannedPlace.place)
  bannedPlaces: BannedPlace[];
}
