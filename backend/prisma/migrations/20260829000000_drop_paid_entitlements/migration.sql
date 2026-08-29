-- Drop SIMP's paid / entitlement platform.
--
-- SIMP is now a fully free app — no IAP, no SIMP+/Elite tier, no
-- entitlement audit log, no boost scoring. This migration removes the
-- Entitlement / EntitlementEvent tables, the Profile fields that
-- existed only to support the paid tier (isPremium + boost decay), the
-- DailyUsage.boosts column (the boost UI no longer exists), and the
-- Postgres enums those structures depended on.
--
-- Idempotency is not relevant here — re-running would simply fail at
-- the DROP statements, which is the desired behavior for a single
-- forward migration.

-- DropTable
DROP TABLE IF EXISTS "EntitlementEvent" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "Entitlement" CASCADE;

-- DropIndex
DROP INDEX IF EXISTS "Profile_boostScore_idx";
DROP INDEX IF EXISTS "Profile_boostedUntil_idx";

-- DropColumn (paid-tier cache + Elite boost columns on Profile)
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "isPremium";
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "boostScore";
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "boostedUntil";
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "lastBoostedAt";

-- DropColumn (boosts counter on DailyUsage — boost UI no longer exists)
ALTER TABLE "DailyUsage" DROP COLUMN IF EXISTS "boosts";

-- DropEnum
DROP TYPE IF EXISTS "EntitlementTier";
DROP TYPE IF EXISTS "EntitlementStatus";
DROP TYPE IF EXISTS "EntitlementEventType";
DROP TYPE IF EXISTS "EntitlementEventSource";
DROP TYPE IF EXISTS "BillingPlatform";
