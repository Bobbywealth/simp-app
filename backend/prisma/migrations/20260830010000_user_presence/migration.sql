-- Add User.presence column (NOT NULL DEFAULT 'online').
--
-- schema.prisma declares `presence String @default("online")` (added
-- in 5eaf7b1, "presence controls") but the DB never got the column.
-- /auth/login and /auth/refresh 500'd with "column User.presence
-- does not exist".
--
-- ADD COLUMN IF NOT EXISTS keeps the migration idempotent: a fresh
-- database gets the column; a database that already has it (e.g.
-- from the startup column shim that ran before this migration was
-- applied) is left untouched. The shape (NOT NULL DEFAULT 'online')
-- matches what schema.prisma expects.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "presence" TEXT NOT NULL DEFAULT 'online';