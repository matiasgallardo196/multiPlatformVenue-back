-- Migración para vincular Supabase Auth con la tabla users

-- 1. Agregar columna email (nullable)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2. Agregar columna supabaseUserId (nullable y unique)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS "supabaseUserId" VARCHAR(255) UNIQUE;

-- 3. Hacer passwordHash nullable (ya que Supabase maneja las contraseñas)
ALTER TABLE users 
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- 4. Agregar roles 'manager' y 'staff' al tipo UserRole si no existen
-- Nota: Si role es un ENUM, deberás actualizar el tipo:
-- ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'manager';
-- ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'staff';

-- Si role es VARCHAR, no necesitas hacer nada adicional

-- 5. Crear índice para mejorar búsquedas por supabaseUserId
CREATE INDEX IF NOT EXISTS "idx_users_supabase_id" ON users("supabaseUserId");

-- 6. Crear índice para email
CREATE INDEX IF NOT EXISTS "idx_users_email" ON users(email);

