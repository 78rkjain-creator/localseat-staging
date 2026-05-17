-- CreateTable
CREATE TABLE "backup_runs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tier" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "sizeBytes" BIGINT,
    "durationMs" INTEGER,
    "errorCode" INTEGER,
    "errorMessage" TEXT,
    "logTail" TEXT,

    CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_runs_startedAt_idx" ON "backup_runs"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "backup_runs_success_startedAt_idx" ON "backup_runs"("success", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "backup_runs_tier_startedAt_idx" ON "backup_runs"("tier", "startedAt" DESC);