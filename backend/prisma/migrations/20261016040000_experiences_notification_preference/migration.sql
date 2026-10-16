-- Add experiences opt-out to notification preferences
ALTER TABLE "NotificationPreference" ADD COLUMN "experiences" BOOLEAN NOT NULL DEFAULT true;
