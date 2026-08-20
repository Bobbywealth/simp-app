-- Web Push support for SIMP PWA.
-- Stores the full PushSubscription JSON (endpoint + p256dh + auth) so the
-- backend can deliver web push notifications via the `web-push` library.
-- Existing FCM-style rows keep their `token` field unchanged; only WEB
-- platform rows use the new `subscription` field.

-- AlterTable
ALTER TABLE "PushToken"
  ADD COLUMN "subscription" JSONB,
  ADD COLUMN "endpoint" TEXT;

-- Index for endpoint lookups (used to mark subscriptions inactive on 404/410).
CREATE UNIQUE INDEX IF NOT EXISTS "PushToken_endpoint_key" ON "PushToken"("endpoint") WHERE "endpoint" IS NOT NULL;
