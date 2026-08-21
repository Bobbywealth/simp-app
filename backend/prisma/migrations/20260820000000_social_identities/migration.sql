-- Add the SocialProvider + SocialIdentity tables so we can support
-- Sign in with Apple (and later Google) without coupling account identity
-- to a single email/password credential.

-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('APPLE', 'GOOGLE');

-- AlterEnum: extend AuthTokenType with APPLE_ACCOUNT_MERGE (used when an
-- existing user links an Apple identity from a device they didn't enroll).
ALTER TYPE "AuthTokenType" ADD VALUE 'APPLE_ACCOUNT_MERGE';

-- CreateTable
CREATE TABLE "SocialIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "rawProfile" JSONB,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialIdentity_provider_subject_key" ON "SocialIdentity"("provider", "subject");

-- CreateIndex
CREATE INDEX "SocialIdentity_userId_provider_idx" ON "SocialIdentity"("userId", "provider");

-- AddForeignKey
ALTER TABLE "SocialIdentity" ADD CONSTRAINT "SocialIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
