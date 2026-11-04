-- Group chat for plans (host + approved guests).
CREATE TABLE "PlanMessage" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlanMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanMessage_experienceId_createdAt_idx" ON "PlanMessage"("experienceId", "createdAt");
CREATE INDEX "PlanMessage_senderId_idx" ON "PlanMessage"("senderId");
