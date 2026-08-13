-- 18+ age gate + Terms of Service / Privacy Policy acceptance tracking.
-- Required for App Store / Stripe / CCPA / GDPR compliance for dating apps.

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "ageConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "ageConfirmedIp" TEXT;

-- CreateTable: TosVersion
-- A versioned snapshot of a legal document (ToS or Privacy Policy).
CREATE TABLE "TosVersion" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TosVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TosAcceptance
-- One row per user acceptance of a specific TosVersion.
CREATE TABLE "TosAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tosVersionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "TosAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TosVersion_type_version_key" ON "TosVersion"("type", "version");
CREATE INDEX "TosVersion_type_effectiveAt_idx" ON "TosVersion"("type", "effectiveAt");
CREATE INDEX "TosAcceptance_userId_type_version_idx" ON "TosAcceptance"("userId", "type", "version");

-- AddForeignKey
ALTER TABLE "TosAcceptance" ADD CONSTRAINT "TosAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TosAcceptance" ADD CONSTRAINT "TosAcceptance_tosVersionId_fkey" FOREIGN KEY ("tosVersionId") REFERENCES "TosVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
