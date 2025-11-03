-- Add violations tracking to Banned

ALTER TABLE "Banned"
ADD COLUMN IF NOT EXISTS "violationsCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Banned"
ADD COLUMN IF NOT EXISTS "violationDates" TIMESTAMPTZ[] NOT NULL DEFAULT '{}';


