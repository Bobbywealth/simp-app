-- Add nullable imageUrl to Message for image-message support.
-- The column was added to prisma/schema.prisma (in the Messaging.Image
-- messageType branch) but the corresponding ALTER TABLE was never
-- written, so /matches and /conversations 500'd with
-- "column Message.imageUrl does not exist" against the running DB.
--
-- ADD COLUMN IF NOT EXISTS keeps the migration idempotent.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;