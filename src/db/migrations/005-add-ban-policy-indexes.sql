-- Migration to add indexes for ban policy system performance optimization

-- Add composite index for Banned table to optimize active ban queries
-- This helps with queries filtering by personId and date ranges
-- Note: personId is a column created by TypeORM's JoinColumn, referenced as FK from Persons table
CREATE INDEX IF NOT EXISTS "idx_banned_person_dates" 
ON "Banned"("personId", "startingDate", "endingDate");

-- Add composite index for BannedPlaces table to optimize place-based queries
-- This helps with queries filtering by placeId and ban status
CREATE INDEX IF NOT EXISTS "idx_banned_places_composite" 
ON "BannedPlaces"("placeId", "bannedId", "status");


