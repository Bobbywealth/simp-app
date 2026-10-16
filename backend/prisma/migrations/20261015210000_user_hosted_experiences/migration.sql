-- User-hosted experiences: host + status on Experience, new ExperienceRequest table.
--
-- All statements are guarded (IF NOT EXISTS / duplicate_object rescue) so the
-- migration is safely re-runnable. Render runs `prisma migrate deploy` on every
-- build, so the schema must converge from any prior state.

-- Enums
DO $$
BEGIN
  CREATE TYPE "ExperienceStatus" AS ENUM ('DRAFT', 'OPEN', 'FULL', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ExperienceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Experience.hostId: add as nullable first so legacy admin-curated rows survive,
-- backfill them, then enforce NOT NULL.
ALTER TABLE "Experience" ADD COLUMN IF NOT EXISTS "hostId" TEXT;

-- Backfill legacy rows with the earliest admin (or earliest user as fallback).
-- Every database containing experiences necessarily contains users.
UPDATE "Experience"
SET "hostId" = COALESCE(
  (SELECT "id" FROM "User" WHERE "role" IN ('ADMIN', 'SUPER_ADMIN') ORDER BY "createdAt" ASC LIMIT 1),
  (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "hostId" IS NULL;

ALTER TABLE "Experience" ALTER COLUMN "hostId" SET NOT NULL;

-- Experience.status, defaulting legacy rows to OPEN.
ALTER TABLE "Experience" ADD COLUMN IF NOT EXISTS "status" "ExperienceStatus" NOT NULL DEFAULT 'OPEN';

-- FK: Experience.hostId -> User.id
DO $$
BEGIN
  ALTER TABLE "Experience" ADD CONSTRAINT "Experience_hostId_fkey"
    FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Experience_hostId_idx" ON "Experience"("hostId");
CREATE INDEX IF NOT EXISTS "Experience_status_startsAt_idx" ON "Experience"("status", "startsAt");

-- ExperienceRequest table
CREATE TABLE IF NOT EXISTS "ExperienceRequest" (
  "id"           TEXT NOT NULL,
  "experienceId" TEXT NOT NULL,
  "requesterId"  TEXT NOT NULL,
  "note"         VARCHAR(500),
  "status"       "ExperienceRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExperienceRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "ExperienceRequest" ADD CONSTRAINT "ExperienceRequest_experienceId_fkey"
    FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ExperienceRequest" ADD CONSTRAINT "ExperienceRequest_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ExperienceRequest" ADD CONSTRAINT "ExperienceRequest_experienceId_requesterId_key"
    UNIQUE ("experienceId", "requesterId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ExperienceRequest_experienceId_status_idx" ON "ExperienceRequest"("experienceId", "status");
CREATE INDEX IF NOT EXISTS "ExperienceRequest_requesterId_status_idx" ON "ExperienceRequest"("requesterId", "status");
