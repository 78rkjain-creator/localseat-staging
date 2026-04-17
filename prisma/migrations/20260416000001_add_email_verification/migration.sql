-- Add email verification fields to users table
ALTER TABLE "users" ADD COLUMN "emailVerified" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "verificationToken" TEXT;
ALTER TABLE "users" ADD COLUMN "verificationTokenExpiry" TIMESTAMP(3);

-- Unique index on verificationToken for fast lookup
CREATE UNIQUE INDEX "users_verificationToken_key" ON "users"("verificationToken");
