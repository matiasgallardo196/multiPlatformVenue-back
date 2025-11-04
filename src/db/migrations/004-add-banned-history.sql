-- Migration to add BannedHistory table for tracking ban changes

-- Create enum type for BannedHistoryAction if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "BannedHistoryAction" AS ENUM ('created', 'updated', 'approved', 'rejected', 'place_added', 'place_removed', 'dates_changed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create BannedHistory table
CREATE TABLE IF NOT EXISTS "BannedHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bannedId" UUID NOT NULL,
  "action" "BannedHistoryAction" NOT NULL,
  "performedByUserId" UUID NOT NULL,
  "performedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "details" JSONB,
  "placeId" UUID,
  CONSTRAINT "PK_BannedHistory" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "BannedHistory"
ADD CONSTRAINT "FK_banned_history_banned"
FOREIGN KEY ("bannedId") REFERENCES "Banned"(id)
ON DELETE CASCADE;

ALTER TABLE "BannedHistory"
ADD CONSTRAINT "FK_banned_history_performed_by"
FOREIGN KEY ("performedByUserId") REFERENCES "users"(id)
ON DELETE RESTRICT;

ALTER TABLE "BannedHistory"
ADD CONSTRAINT "FK_banned_history_place"
FOREIGN KEY ("placeId") REFERENCES "Places"(id)
ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_banned_history_banned_id" ON "BannedHistory"("bannedId");
CREATE INDEX IF NOT EXISTS "idx_banned_history_performed_at" ON "BannedHistory"("performedAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_banned_history_action" ON "BannedHistory"("action");
CREATE INDEX IF NOT EXISTS "idx_banned_history_place_id" ON "BannedHistory"("placeId");




