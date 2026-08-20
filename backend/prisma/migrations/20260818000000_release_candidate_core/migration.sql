-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('HARASSMENT', 'HATE_SPEECH', 'SCAM', 'IMPERSONATION', 'FAKE_PROFILE', 'INAPPROPRIATE_SEXUAL_CONTENT', 'UNDERAGE_USER', 'THREAT_VIOLENCE', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MATCH', 'MESSAGE', 'LIKE', 'SYSTEM', 'LIVE', 'SECURITY');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "EntitlementTier" AS ENUM ('FREE', 'SIMP_PLUS', 'SIMP_ELITE');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "BillingPlatform" AS ENUM ('APPLE', 'GOOGLE', 'WEB', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('WARN', 'SUSPEND', 'BAN', 'RESTORE', 'REMOVE_PHOTO', 'END_STREAM', 'APPROVE_VERIFICATION', 'REJECT_VERIFICATION');

-- CreateEnum
CREATE TYPE "LiveReactionType" AS ENUM ('HEART');

-- CreateEnum
CREATE TYPE "ExperienceCategory" AS ENUM ('DINNER', 'DRINKS', 'EVENT', 'CONCERT', 'TRAVEL', 'SHOPPING', 'ADVENTURE', 'VIP', 'OTHER');

-- DropForeignKey
ALTER TABLE "UserInterest" DROP CONSTRAINT "UserInterest_profileId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_reportedId_fkey";

-- DropIndex
DROP INDEX "Swipe_swiperId_idx";

-- DropIndex
DROP INDEX "Swipe_swipedId_idx";

-- DropIndex
DROP INDEX "Match_userAId_idx";

-- DropIndex
DROP INDEX "Match_userBId_idx";

-- DropIndex
DROP INDEX "Prompt_userId_idx";

-- DropIndex
DROP INDEX "Report_reporterId_idx";

-- DropIndex
DROP INDEX "Report_reportedId_idx";

-- DropIndex
DROP INDEX "LiveStream_status_idx";

-- DropIndex
DROP INDEX "LiveStream_broadcasterId_idx";

-- DropIndex
DROP INDEX "LiveChatMessage_streamId_createdAt_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "onboardingState" JSONB,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "suspendedUntil" TIMESTAMP(3);

-- Existing accounts predate email verification. Grandfather them so the
-- release migration does not lock established users out of protected flows.
UPDATE "User"
SET "emailVerified" = true,
    "emailVerifiedAt" = COALESCE("emailVerifiedAt", CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "profileCompletedAt" TIMESTAMP(3),
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_REQUESTED';

UPDATE "Profile"
SET "verificationStatus" = CASE
  WHEN "isVerified" = true THEN 'APPROVED'::"VerificationStatus"
  ELSE 'NOT_REQUESTED'::"VerificationStatus"
END;

UPDATE "Profile" p
SET "profileCompletedAt" = COALESCE(p."updatedAt", CURRENT_TIMESTAMP)
WHERE p."displayName" <> ''
  AND p."birthDate" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Photo" ph WHERE ph."userId" = p."userId");

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "bytes" INTEGER,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "UserInterest" DROP COLUMN "profileId";

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "deviceName" TEXT,
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "platform" "PushPlatform" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "replacedById" TEXT,
ADD COLUMN     "reuseDetectedAt" TIMESTAMP(3),
ADD COLUMN     "userAgent" TEXT;

UPDATE "RefreshToken" SET "familyId" = "id" WHERE "familyId" IS NULL;
ALTER TABLE "RefreshToken" ALTER COLUMN "familyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedById" TEXT;

-- AlterTable
ALTER TABLE "Prompt" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "actionedAt" TIMESTAMP(3),
ADD COLUMN     "category" "ReportCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "contextKey" TEXT,
ADD COLUMN     "moderatorId" TEXT,
ADD COLUMN     "moderatorNotes" TEXT,
ADD COLUMN     "reportedFingerprint" TEXT,
ADD COLUMN     "reporterFingerprint" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "streamId" TEXT,
ALTER COLUMN "reporterId" DROP NOT NULL,
ALTER COLUMN "reportedId" DROP NOT NULL;

UPDATE "Report"
SET "category" = CASE
  WHEN lower("reason") LIKE '%harass%' THEN 'HARASSMENT'::"ReportCategory"
  WHEN lower("reason") LIKE '%hate%' THEN 'HATE_SPEECH'::"ReportCategory"
  WHEN lower("reason") LIKE '%scam%' THEN 'SCAM'::"ReportCategory"
  WHEN lower("reason") LIKE '%spam%' THEN 'SPAM'::"ReportCategory"
  WHEN lower("reason") LIKE '%fake%' THEN 'FAKE_PROFILE'::"ReportCategory"
  WHEN lower("reason") LIKE '%underage%' THEN 'UNDERAGE_USER'::"ReportCategory"
  WHEN lower("reason") LIKE '%inappropriate%' THEN 'INAPPROPRIATE_SEXUAL_CONTENT'::"ReportCategory"
  ELSE 'OTHER'::"ReportCategory"
END;

-- AlterTable
ALTER TABLE "LiveStream" ADD COLUMN     "heartCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LiveChatMessage" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DiscoveryPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minAge" INTEGER NOT NULL DEFAULT 18,
    "maxAge" INTEGER NOT NULL DEFAULT 99,
    "maxDistanceKm" INTEGER,
    "verifiedOnly" BOOLEAN NOT NULL DEFAULT false,
    "interestSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "locationPrecisionKm" INTEGER,
    "locationUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryPreference_pkey" PRIMARY KEY ("id")
);

INSERT INTO "DiscoveryPreference" ("id", "userId", "createdAt", "updatedAt")
SELECT 'dp_' || md5(u."id"), u."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u;

-- CreateTable
CREATE TABLE "AuthActionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- Every existing match receives exactly one conversation so old matches can
-- enter messaging immediately after the release.
INSERT INTO "Conversation" ("id", "matchId", "createdAt", "updatedAt")
SELECT 'conv_' || md5(m."id"), m."id", m."createdAt", CURRENT_TIMESTAMP
FROM "Match" m;

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "clientId" TEXT,
    "body" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL DEFAULT 'TEXT',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "moderatorId" TEXT,
    "targetUserId" TEXT,
    "targetFingerprint" TEXT,
    "action" "ModerationActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileVerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "userNote" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ProfileVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveReaction" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LiveReactionType" NOT NULL DEFAULT 'HEART',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveModeration" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "mutedUntil" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveModeration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "NotificationType" NOT NULL,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matches" BOOLEAN NOT NULL DEFAULT true,
    "messages" BOOLEAN NOT NULL DEFAULT true,
    "likes" BOOLEAN NOT NULL DEFAULT true,
    "live" BOOLEAN NOT NULL DEFAULT true,
    "security" BOOLEAN NOT NULL DEFAULT true,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

INSERT INTO "NotificationPreference" ("id", "userId", "createdAt", "updatedAt")
SELECT 'np_' || md5(u."id"), u."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u;

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "platform" "PushPlatform" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "EntitlementTier" NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "platform" "BillingPlatform" NOT NULL,
    "productId" TEXT NOT NULL,
    "transactionId" TEXT,
    "originalTransactionId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "autoRenewing" BOOLEAN NOT NULL DEFAULT false,
    "environment" TEXT,
    "receiptHash" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "superLikes" INTEGER NOT NULL DEFAULT 0,
    "rewinds" INTEGER NOT NULL DEFAULT 0,
    "boosts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "ExperienceCategory" NOT NULL,
    "city" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "provider" TEXT,
    "capacity" INTEGER,
    "bookingUrl" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryPreference_userId_key" ON "DiscoveryPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthActionToken_tokenHash_key" ON "AuthActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthActionToken_userId_type_expiresAt_idx" ON "AuthActionToken"("userId", "type", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_matchId_key" ON "Conversation"("matchId");

-- CreateIndex
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_clientId_key" ON "Message"("conversationId", "clientId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_id_idx" ON "Message"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_readAt_idx" ON "Message"("conversationId", "readAt");

-- CreateIndex
CREATE INDEX "ModerationAction_targetUserId_createdAt_idx" ON "ModerationAction"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAction_moderatorId_createdAt_idx" ON "ModerationAction"("moderatorId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileVerificationRequest_status_createdAt_idx" ON "ProfileVerificationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileVerificationRequest_userId_createdAt_idx" ON "ProfileVerificationRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveReaction_streamId_createdAt_idx" ON "LiveReaction"("streamId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveReaction_userId_createdAt_idx" ON "LiveReaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveModeration_userId_idx" ON "LiveModeration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveModeration_streamId_userId_key" ON "LiveModeration"("streamId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_active_idx" ON "PushToken"("userId", "active");

-- CreateIndex
CREATE INDEX "PushToken_platform_active_idx" ON "PushToken"("platform", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_transactionId_key" ON "Entitlement"("transactionId");

-- CreateIndex
CREATE INDEX "Entitlement_userId_status_expiresAt_idx" ON "Entitlement"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "Entitlement_originalTransactionId_idx" ON "Entitlement"("originalTransactionId");

-- CreateIndex
CREATE INDEX "DailyUsage_day_idx" ON "DailyUsage"("day");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUsage_userId_day_key" ON "DailyUsage"("userId", "day");

-- CreateIndex
CREATE INDEX "Experience_isActive_city_startsAt_idx" ON "Experience"("isActive", "city", "startsAt");

-- CreateIndex
CREATE INDEX "Experience_category_startsAt_idx" ON "Experience"("category", "startsAt");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Profile_gender_birthDate_idx" ON "Profile"("gender", "birthDate");

-- CreateIndex
CREATE INDEX "Profile_verificationStatus_idx" ON "Profile"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_publicId_key" ON "Photo"("publicId");

-- CreateIndex
CREATE INDEX "Photo_userId_position_idx" ON "Photo"("userId", "position");

-- CreateIndex
CREATE INDEX "UserInterest_interestId_idx" ON "UserInterest"("interestId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Swipe_swiperId_createdAt_idx" ON "Swipe"("swiperId", "createdAt");

-- CreateIndex
CREATE INDEX "Swipe_swipedId_action_createdAt_idx" ON "Swipe"("swipedId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "Match_userAId_isActive_lastMessageAt_idx" ON "Match"("userAId", "isActive", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Match_userBId_isActive_lastMessageAt_idx" ON "Match"("userBId", "isActive", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Prompt_userId_position_idx" ON "Prompt"("userId", "position");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reportedId_status_idx" ON "Report"("reportedId", "status");

-- CreateIndex
CREATE INDEX "Report_streamId_idx" ON "Report"("streamId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_contextKey_key" ON "Report"("reporterId", "contextKey");

-- CreateIndex
CREATE INDEX "LiveStream_status_startedAt_idx" ON "LiveStream"("status", "startedAt");

-- CreateIndex
CREATE INDEX "LiveStream_broadcasterId_status_idx" ON "LiveStream"("broadcasterId", "status");

-- CreateIndex
CREATE INDEX "LiveChatMessage_streamId_createdAt_id_idx" ON "LiveChatMessage"("streamId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "LiveChatMessage_senderId_createdAt_idx" ON "LiveChatMessage"("senderId", "createdAt");

-- AddForeignKey
ALTER TABLE "DiscoveryPreference" ADD CONSTRAINT "DiscoveryPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthActionToken" ADD CONSTRAINT "AuthActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileVerificationRequest" ADD CONSTRAINT "ProfileVerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileVerificationRequest" ADD CONSTRAINT "ProfileVerificationRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveReaction" ADD CONSTRAINT "LiveReaction_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveReaction" ADD CONSTRAINT "LiveReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveModeration" ADD CONSTRAINT "LiveModeration_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveModeration" ADD CONSTRAINT "LiveModeration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveModeration" ADD CONSTRAINT "LiveModeration_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyUsage" ADD CONSTRAINT "DailyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Durable cleanup queue for storage assets that could not be deleted during
-- request processing. This contains storage identifiers, never account data.
CREATE TABLE "AssetDeletionJob" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AssetDeletionJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetDeletionJob_publicId_key" ON "AssetDeletionJob"("publicId");
CREATE INDEX "AssetDeletionJob_completedAt_nextAttemptAt_idx" ON "AssetDeletionJob"("completedAt", "nextAttemptAt");

CREATE TABLE "AccountDeletionReceipt" (
    "id" TEXT NOT NULL,
    "userFingerprint" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    CONSTRAINT "AccountDeletionReceipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountDeletionReceipt_completedAt_idx" ON "AccountDeletionReceipt"("completedAt");
