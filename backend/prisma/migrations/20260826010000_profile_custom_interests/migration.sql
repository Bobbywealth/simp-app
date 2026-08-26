-- Profile customInterests (up to 3 user-typed tags shown alongside the
-- curated Interest table). Stored as a Postgres text[] column on Profile
-- with a default empty array so existing rows don't need a backfill.

ALTER TABLE "Profile" ADD COLUMN "customInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Profile_customInterests_idx" ON "Profile" USING GIN ("customInterests");
