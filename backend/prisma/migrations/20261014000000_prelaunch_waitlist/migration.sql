-- Prelaunch waitlist table. Anonymous signup capture for the
-- /prelaunch page (Bobby-authorized 2026-10-14). Stores name + email
-- per submission; duplicates update the existing row.
--
-- All statements are guarded with IF NOT EXISTS so the migration is
-- safely re-runnable. Render runs `prisma migrate deploy` on every
-- build, so the schema must converge from any prior state.

CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "source"    TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- Unique on email so duplicate POSTs converge to a single row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'WaitlistEntry_email_key'
  ) THEN
    ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_email_key" UNIQUE ("email");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");