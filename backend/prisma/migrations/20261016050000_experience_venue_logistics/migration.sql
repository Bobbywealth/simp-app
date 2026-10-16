-- Add venue and logistics to experiences
ALTER TABLE "Experience" ADD COLUMN "venue" TEXT;
ALTER TABLE "Experience" ADD COLUMN "logistics" TEXT;
