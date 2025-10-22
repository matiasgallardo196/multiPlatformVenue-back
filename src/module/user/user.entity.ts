import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole =
  | 'admin'
  | 'editor'
  | 'viewer'
  | 'manager'
  | 'staff'
  | 'head-manager';

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

  @Column({ type: 'varchar', length: 16, default: 'viewer' })
  role: UserRole;
}
