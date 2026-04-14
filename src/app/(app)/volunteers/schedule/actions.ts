"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewVolunteers, isReadOnly } from "@/lib/permissions";
import type { Role, VolunteerAttendanceStatus } from "@/types";

async function requireVolunteerAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canViewVolunteers(activeRole as Role)) {
    return { error: "You don't have permission to manage volunteers." } as const;
  }
  if (isReadOnly(activeRole as Role)) {
    return { error: "Read-only access." } as const;
  }
  return { campaignId: activeCampaignId, role: activeRole as Role } as const;
}

// ── Create shift ──────────────────────────────────────────────────────────────

export async function createVolunteerShift(input: {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  notes?: string;
  maxVolunteers?: string;
}): Promise<{ error?: string; shiftId?: string }> {
  const auth = await requireVolunteerAccess();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const name = input.name.trim();
  if (!name) return { error: "Shift name is required." };
  if (!input.date) return { error: "Date is required." };
  if (!input.startTime || !input.endTime) return { error: "Start and end time are required." };

  const shift = await db.volunteerShift.create({
    data: {
      campaignId,
      name,
      date: new Date(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
      maxVolunteers: input.maxVolunteers ? parseInt(input.maxVolunteers, 10) : null,
    },
    select: { id: true },
  });

  revalidatePath("/volunteers/schedule");
  return { shiftId: shift.id };
}

// ── Assign volunteer to shift ─────────────────────────────────────────────────

export async function assignVolunteerToShift(
  shiftId: string,
  recordId: string
): Promise<{ error?: string }> {
  const auth = await requireVolunteerAccess();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const shift = await db.volunteerShift.findFirst({
    where: { id: shiftId, campaignId, deletedAt: null },
    select: { id: true, maxVolunteers: true, _count: { select: { attendees: true } } },
  });
  if (!shift) return { error: "Shift not found." };

  if (shift.maxVolunteers && shift._count.attendees >= shift.maxVolunteers) {
    return { error: "This shift is already at capacity." };
  }

  await db.volunteerShiftAttendee.upsert({
    where: { shiftId_recordId: { shiftId, recordId } },
    create: { shiftId, recordId, status: "pending" },
    update: {},
  });

  revalidatePath("/volunteers/schedule");
  return {};
}

// ── Remove volunteer from shift ───────────────────────────────────────────────

export async function removeVolunteerFromShift(
  shiftId: string,
  recordId: string
): Promise<{ error?: string }> {
  const auth = await requireVolunteerAccess();
  if ("error" in auth) return auth;

  await db.volunteerShiftAttendee.deleteMany({
    where: { shiftId, recordId },
  });

  revalidatePath("/volunteers/schedule");
  return {};
}

// ── Mark attendance ───────────────────────────────────────────────────────────

export async function markAttendance(
  shiftId: string,
  recordId: string,
  status: VolunteerAttendanceStatus
): Promise<{ error?: string }> {
  const auth = await requireVolunteerAccess();
  if ("error" in auth) return auth;

  await db.volunteerShiftAttendee.updateMany({
    where: { shiftId, recordId },
    data: { status },
  });

  revalidatePath("/volunteers/schedule");
  return {};
}

// ── Mark volunteer as committed ───────────────────────────────────────────────

export async function markVolunteerCommitted(
  recordId: string
): Promise<{ error?: string }> {
  const auth = await requireVolunteerAccess();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const record = await db.volunteerRecord.findFirst({
    where: { id: recordId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!record) return { error: "Volunteer record not found." };

  await db.volunteerRecord.update({
    where: { id: recordId },
    data: { status: "committed" },
  });

  revalidatePath("/volunteers/schedule");
  return {};
}
