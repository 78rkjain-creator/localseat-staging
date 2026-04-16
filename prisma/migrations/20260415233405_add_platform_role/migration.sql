-- AlterTable
ALTER TABLE "users" ADD COLUMN     "platformRole" TEXT;

-- CreateIndex
CREATE INDEX "users_platformRole_idx" ON "users"("platformRole");
