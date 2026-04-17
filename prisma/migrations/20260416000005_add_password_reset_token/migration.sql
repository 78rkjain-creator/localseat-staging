ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetTokenExpiry" TIMESTAMP(3);

-- Unique index on passwordResetToken (nullable columns don't need DO/EXCEPTION wrapping)
CREATE UNIQUE INDEX IF NOT EXISTS "users_passwordResetToken_key" ON "users"("passwordResetToken");
