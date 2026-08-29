-- Add User.presence column (NOT NULL DEFAULT 'online').
--
-- schema.prisma declares `presence String @default("online")` (added
-- in 5eaf7b1, "presence controls") but the DB never got the column.
-- /auth/login and /auth/refresh 500'd with "column User.presence
-- does not exist".
--
-- The earlier 20260830010000_user_presence attempt only added the
-- column as nullable TEXT; this rewrite drops + recreates with the
-- correct NOT NULL DEFAULT 'online' shape that schema.prisma expects.

ALTER TABLE "User" DROP COLUMN IF EXISTS "presence";
ALTER TABLE "User" ADD COLUMN "presence" TEXT NOT NULL DEFAULT 'online';