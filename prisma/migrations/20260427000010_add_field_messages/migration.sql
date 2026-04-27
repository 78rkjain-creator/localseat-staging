-- CreateEnum
CREATE TYPE "FieldMessagePriority" AS ENUM ('normal', 'urgent');

-- CreateTable
CREATE TABLE "field_messages" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "priority" "FieldMessagePriority" NOT NULL DEFAULT 'normal',
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "field_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_messages_campaignId_idx" ON "field_messages"("campaignId");

-- CreateIndex
CREATE INDEX "field_messages_deletedAt_idx" ON "field_messages"("deletedAt");

-- AddForeignKey
ALTER TABLE "field_messages" ADD CONSTRAINT "field_messages_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_messages" ADD CONSTRAINT "field_messages_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
