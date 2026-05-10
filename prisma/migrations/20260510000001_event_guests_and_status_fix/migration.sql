-- Make userId optional on event_attendees (to support guest attendees)
ALTER TABLE "event_attendees" ALTER COLUMN "userId" DROP NOT NULL;

-- Add guest fields
ALTER TABLE "event_attendees" ADD COLUMN "guestName" TEXT;
ALTER TABLE "event_attendees" ADD COLUMN "guestEmail" TEXT;
