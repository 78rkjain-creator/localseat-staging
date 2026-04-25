-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('general', 'volunteer_follow_up');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "type" "TaskType" NOT NULL DEFAULT 'general';
