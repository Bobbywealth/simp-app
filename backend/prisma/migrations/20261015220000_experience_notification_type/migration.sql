-- Add EXPERIENCE to NotificationType for experience join/approve/decline notifications.
-- Guarded so the migration is safely re-runnable on Render.

DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EXPERIENCE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
