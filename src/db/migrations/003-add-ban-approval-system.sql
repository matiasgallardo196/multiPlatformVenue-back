-- Migration to add ban approval system fields

-- Add approval fields to Banned table
ALTER TABLE "Banned"
ADD COLUMN IF NOT EXISTS "createdByUserId" UUID NOT NULL;

-- Add foreign key constraint for createdByUserId
ALTER TABLE "Banned"
ADD CONSTRAINT "FK_banned_created_by"
FOREIGN KEY ("createdByUserId") REFERENCES "users"(id)
ON DELETE RESTRICT;

-- Add lastModifiedByUserId to Banned table
ALTER TABLE "Banned"
ADD COLUMN IF NOT EXISTS "lastModifiedByUserId" UUID;

-- Add foreign key constraint for lastModifiedByUserId
ALTER TABLE "Banned"
ADD CONSTRAINT "FK_banned_last_modified_by"
FOREIGN KEY ("lastModifiedByUserId") REFERENCES "users"(id)
ON DELETE SET NULL;

-- Add requiresApproval to Banned table
ALTER TABLE "Banned"
ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- Create enum type for BannedPlaceStatus if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "BannedPlaceStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add status to BannedPlaces table
ALTER TABLE "BannedPlaces"
ADD COLUMN IF NOT EXISTS "status" "BannedPlaceStatus" NOT NULL DEFAULT 'pending';

-- Add approvedByUserId to BannedPlaces table
ALTER TABLE "BannedPlaces"
ADD COLUMN IF NOT EXISTS "approvedByUserId" UUID;

-- Add foreign key constraint for approvedByUserId
ALTER TABLE "BannedPlaces"
ADD CONSTRAINT "FK_banned_places_approved_by"
FOREIGN KEY ("approvedByUserId") REFERENCES "users"(id)
ON DELETE SET NULL;

-- Add rejectedByUserId to BannedPlaces table
ALTER TABLE "BannedPlaces"
ADD COLUMN IF NOT EXISTS "rejectedByUserId" UUID;

-- Add foreign key constraint for rejectedByUserId
ALTER TABLE "BannedPlaces"
ADD CONSTRAINT "FK_banned_places_rejected_by"
FOREIGN KEY ("rejectedByUserId") REFERENCES "users"(id)
ON DELETE SET NULL;

-- Add approvedAt to BannedPlaces table
ALTER TABLE "BannedPlaces"
ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ;

-- Add rejectedAt to BannedPlaces table
ALTER TABLE "BannedPlaces"
ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMPTZ;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_banned_created_by" ON "Banned"("createdByUserId");
CREATE INDEX IF NOT EXISTS "idx_banned_places_status" ON "BannedPlaces"("status");
CREATE INDEX IF NOT EXISTS "idx_banned_places_place_status" ON "BannedPlaces"("placeId", "status");


