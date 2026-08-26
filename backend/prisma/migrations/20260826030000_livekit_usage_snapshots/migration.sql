-- Daily LiveKit Cloud usage snapshots. The backend cron job writes one
-- row per day so admins can plot usage over time and trip alerts when
-- the free tier runs out.

CREATE TABLE "LivekitUsageSnapshot" (
    "id" TEXT NOT NULL,
    "participantMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "participantMinutesLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recordingStorageGb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recordingStorageLimitGb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "egressGb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "egressLimitGb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "planName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LivekitUsageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LivekitUsageSnapshot_createdAt_idx" ON "LivekitUsageSnapshot"("createdAt");
