import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Place } from '../../shared/entities/place.entity';

export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  MANAGER = 'manager',
  STAFF = 'staff',
  HEAD_MANAGER = 'head-manager',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  passwordHash: string; // Ahora opcional, Supabase maneja las contraseñas

  @Column({ type: 'varchar', unique: true, nullable: true })
  supabaseUserId: string; // ID del usuario en Supabase Auth

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.VIEWER,
  })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true })
  placeId: string | null;

  @ManyToOne(() => Place, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'placeId' })
  place: Place | null;
}
