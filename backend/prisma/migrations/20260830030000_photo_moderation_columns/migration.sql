-- Photo moderation columns added in 5eaf7b1 ("photo moderation:
-- nsfwjs async check, PhotoStatus enum, pending/approved/rejected"):
-- - PhotoStatus enum (PENDING, APPROVED, REJECTED)
-- - Photo.status column, default PENDING, indexed
--
-- Without this migration, queries that select Photo.status 500 with
-- "column Photo.status does not exist". All statements are guarded
-- with IF NOT EXISTS so the migration is safely idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PhotoStatus') THEN
    CREATE TYPE "PhotoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "status" "PhotoStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill any existing NULL status rows (defensive: should be empty
-- because the column is NOT NULL DEFAULT, but harmless if it runs).
UPDATE "Photo" SET "status" = 'PENDING' WHERE "status" IS NULL;

-- The @@index([status]) declared in schema.prisma.
CREATE INDEX IF NOT EXISTS "Photo_status_idx" ON "Photo"("status");