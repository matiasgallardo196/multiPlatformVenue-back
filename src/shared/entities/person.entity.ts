import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Incident } from './incident.entity';

@Entity({ name: 'Persons' })
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nickname: string;

  @Column({
    type: 'text',
    array: true,
    nullable: true,
  })
  imagenProfileUrl: string[];

  @OneToMany(() => Incident, (incident) => incident.person)
  incidents: Incident[];
}
