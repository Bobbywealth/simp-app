-- LiveKit recording retention. recordingEgressId is the LiveKit egress
-- handle written when startRecording succeeds; recordingUrl is the
-- resolved S3-compatible destination once the egress finishes (filled by
-- the post-stop hook on the next stream end).

ALTER TABLE "LiveStream" ADD COLUMN "recordingEgressId" TEXT;
ALTER TABLE "LiveStream" ADD COLUMN "recordingUrl" TEXT;
