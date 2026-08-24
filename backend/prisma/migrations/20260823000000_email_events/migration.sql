-- Add email deliverability tracking.
--
-- Resend's webhook stream reports per-recipient events (delivered,
-- bounced, complained, opened, clicked). We persist them in EmailEvent
-- for an audit trail and on bounce/complaint we mark the matching user
-- so we can suppress future sends to dead addresses and prompt the
-- user to update their email.
--
-- The User.emailBounceAt / emailBounceType columns are nullable so this
-- migration is safe to apply against a populated database.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailBounceAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailBounceType" TEXT;

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "subject" TEXT,
    "messageId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailEvent_userId_createdAt_idx" ON "EmailEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailEvent_email_createdAt_idx" ON "EmailEvent"("email", "createdAt");

-- CreateIndex
CREATE INDEX "EmailEvent_type_createdAt_idx" ON "EmailEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
