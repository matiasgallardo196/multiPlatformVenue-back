-- Migración para agregar columna placeEmail a la tabla Places

-- Agregar columna placeEmail (VARCHAR(255), NOT NULL)
ALTER TABLE "Places" 
ADD COLUMN IF NOT EXISTS "placeEmail" VARCHAR(255) NOT NULL DEFAULT '';

-- Nota: Si ya existen registros en la tabla, deberás actualizar manualmente
-- los valores antes de ejecutar esta migración, o cambiar el DEFAULT a un valor válido
-- y luego eliminar el DEFAULT con: ALTER TABLE "Places" ALTER COLUMN "placeEmail" DROP DEFAULT;

