-- AlterTable
ALTER TABLE "ProfileVerificationRequest"
  ADD COLUMN "selfieUrl" TEXT,
  ADD COLUMN "selfiePublicId" TEXT,
  ADD COLUMN "poseSequence" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "livenessHints" JSONB;