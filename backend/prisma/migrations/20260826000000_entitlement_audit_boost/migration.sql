-- EntitlementEvent audit log + Profile.boost fields for Elite placement.
-- Idempotent: every EntitlementEvent write keyed by externalId (Apple
-- notificationUUID, Google Pub/Sub messageId, or manual verify) so a
-- webhook replay cannot double-write.

-- CreateEnum
CREATE TYPE "EntitlementEventType" AS ENUM (
  'PURCHASE',
  'RENEWAL',
  'UPGRADE',
  'DOWNGRADE',
  'CANCEL',
  'REFUND',
  'GRACE_PERIOD',
  'RECOVER',
  'EXPIRE',
  'RESTORE',
  'PAUSE',
  'UNCANCEL'
);

CREATE TYPE "EntitlementEventSource" AS ENUM (
  'APPLE_VERIFY',
  'APPLE_WEBHOOK',
  'APPLE_REFRESH',
  'GOOGLE_VERIFY',
  'GOOGLE_RTDN',
  'GOOGLE_PUBSUB',
  'CLIENT_VERIFY',
  'CLIENT_RESTORE',
  'RECONCILE'
);

-- CreateTable
CREATE TABLE "EntitlementEvent" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EntitlementEventType" NOT NULL,
    "source" "EntitlementEventSource" NOT NULL,
    "tier" "EntitlementTier" NOT NULL,
    "status" "EntitlementStatus" NOT NULL,
    "platform" "BillingPlatform" NOT NULL,
    "productId" TEXT NOT NULL,
    "transactionId" TEXT,
    "originalTransactionId" TEXT,
    "externalId" TEXT,
    "environment" TEXT,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntitlementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: dedupe on externalId per (platform, source)
CREATE UNIQUE INDEX "EntitlementEvent_externalId_key"
  ON "EntitlementEvent"("externalId")
  WHERE "externalId" IS NOT NULL;

CREATE INDEX "EntitlementEvent_userId_createdAt_idx"
  ON "EntitlementEvent"("userId", "createdAt");

CREATE INDEX "EntitlementEvent_entitlementId_idx"
  ON "EntitlementEvent"("entitlementId");

CREATE INDEX "EntitlementEvent_type_createdAt_idx"
  ON "EntitlementEvent"("type", "createdAt");

-- Profile boost fields (Elite priority placement)
ALTER TABLE "Profile" ADD COLUMN "boostScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Profile" ADD COLUMN "boostedUntil" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "lastBoostedAt" TIMESTAMP(3);

CREATE INDEX "Profile_boostScore_idx" ON "Profile"("boostScore");
CREATE INDEX "Profile_boostedUntil_idx" ON "Profile"("boostedUntil");

-- Foreign keys
ALTER TABLE "EntitlementEvent" ADD CONSTRAINT "EntitlementEvent_entitlementId_fkey"
  FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntitlementEvent" ADD CONSTRAINT "EntitlementEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
