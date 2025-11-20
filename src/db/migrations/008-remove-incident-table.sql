-- Eliminar foreign keys de la tabla Incidents
ALTER TABLE "Incidents" DROP CONSTRAINT IF EXISTS "FK_Incidents_personId";
ALTER TABLE "Incidents" DROP CONSTRAINT IF EXISTS "FK_Incidents_placeId";

-- Eliminar la tabla Incidents
DROP TABLE IF EXISTS "Incidents";

