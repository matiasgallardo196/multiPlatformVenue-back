-- Ensure incidentNumber is globally unique for Banned
ALTER TABLE "Banned"
ADD CONSTRAINT "UQ_Banned_incidentNumber" UNIQUE ("incidentNumber");


