import { Column, Entity, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Incident } from './incident.entity';
import { Banned } from './banned.entity';

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

  @Column({
    type: 'enum',
    enum: ['Male', 'Female'],
    nullable: true,
  })
  gender: 'Male' | 'Female' | null;

  @OneToMany(() => Incident, (incident) => incident.person)
  incidents: Incident[];

  @OneToMany(() => Banned, (banned) => banned.person)
  banneds: Banned[];

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: false })
  updatedAt: Date;
}
