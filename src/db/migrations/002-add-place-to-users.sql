-- Migración para agregar relación place a la tabla users

-- 1. Agregar columna placeId (UUID, nullable)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS "placeId" UUID;

-- 2. Agregar foreign key constraint a la tabla Places
-- Primero verificar que la tabla Places existe y tiene una columna id de tipo UUID
ALTER TABLE users
ADD CONSTRAINT IF NOT EXISTS "FK_users_place" 
FOREIGN KEY ("placeId") 
REFERENCES "Places"(id) 
ON DELETE SET NULL;

-- 3. Crear índice para mejorar búsquedas por placeId
CREATE INDEX IF NOT EXISTS "idx_users_place_id" ON users("placeId");

