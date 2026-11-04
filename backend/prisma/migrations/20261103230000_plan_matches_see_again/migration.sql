-- Plan connections vs real matches, plus the private post-plan "see again" signal.
CREATE TYPE "MatchKind" AS ENUM ('MUTUAL', 'PLAN');

ALTER TABLE "Match" ADD COLUMN "kind" "MatchKind" NOT NULL DEFAULT 'MUTUAL';
ALTER TABLE "Match" ADD COLUMN "experienceId" TEXT;

CREATE TABLE "ExperienceSeeAgain" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperienceSeeAgain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExperienceSeeAgain_experienceId_fromUserId_toUserId_key" ON "ExperienceSeeAgain"("experienceId", "fromUserId", "toUserId");
CREATE INDEX "ExperienceSeeAgain_experienceId_toUserId_idx" ON "ExperienceSeeAgain"("experienceId", "toUserId");
