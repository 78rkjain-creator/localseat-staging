-- CreateEnum
CREATE TYPE "VolunteerStatus" AS ENUM ('interested', 'committed');

-- CreateEnum
CREATE TYPE "VolunteerAttendanceStatus" AS ENUM ('pending', 'attended', 'no_show');

-- CreateTable
CREATE TABLE "volunteer_records" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "VolunteerStatus" NOT NULL DEFAULT 'interested',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "volunteer_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_shifts" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "maxVolunteers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "volunteer_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_shift_attendees" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "status" "VolunteerAttendanceStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteer_shift_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_records_campaignId_personId_key" ON "volunteer_records"("campaignId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_shift_attendees_shiftId_recordId_key" ON "volunteer_shift_attendees"("shiftId", "recordId");

-- AddForeignKey
ALTER TABLE "volunteer_records" ADD CONSTRAINT "volunteer_records_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_records" ADD CONSTRAINT "volunteer_records_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_shifts" ADD CONSTRAINT "volunteer_shifts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_shift_attendees" ADD CONSTRAINT "volunteer_shift_attendees_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "volunteer_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_shift_attendees" ADD CONSTRAINT "volunteer_shift_attendees_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "volunteer_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
