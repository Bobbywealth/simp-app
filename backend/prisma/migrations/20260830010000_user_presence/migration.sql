-- Add User.presence column (NOT NULL with default 'online').
--
-- schema.prisma now declares `presence String @default("online")` as
-- part of the online-presence feature (commit 5eaf7b1, "presence
-- controls"). The DB was never migrated to match the new schema, so
-- /auth/login and /auth/refresh 500'd with PrismaClientKnownRequestError
-- "column User.presence does not exist" for every account.
ALTER TABLE "User" ADD COLUMN "presence" TEXT NOT NULL DEFAULT 'online';
