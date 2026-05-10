"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { canViewAllPeople } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { checkSupportWriteAccess } from "@/lib/support-access";
import type { Role } from "@/types";
import type { EventType, EventStatus } from "@prisma/client";

const EVENT_TYPE_VALUES: EventType[] = [
  "campaign_event", "fundraiser", "town_hall", "debate",
  "canvass_kickoff", "volunteer_training", "other",
];
const EVENT_STATUS_VALUES: EventStatus[] = [
  "upcoming", "in_progress", "completed", "cancelled",
];

function parseEventType(v: string | null): EventType {
  if (v && EVENT_TYPE_VALUES.includes(v as EventType)) return v as EventType;
  return "other";
}

function parseEventStatus(v: string | null): EventStatus {
  if (v && EVENT_STATUS_VALUES.includes(v as EventStatus)) return v as EventStatus;
  return "upcoming";
}

// ── Recurring date generation ──────────────────────────────────────────────

// weekdays: 0=Mon … 6=Sun (matching Mon-first convention)
function generateRecurringDates(
  startDate: Date,
  weekdays: number[],
  endType: "date" | "count",
  endDate: Date | null,
  endCount: number | null
): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const endOfRange = endDate ? new Date(endDate) : null;
  if (endOfRange) endOfRange.setHours(23, 59, 59, 999);

  for (let i = 0; i < 400; i++) {
    if (endType === "date" && endOfRange && cursor > endOfRange) break;

    // JS getDay(): 0=Sun…6=Sat → convert to Mon=0…Sun=6
    const jsDay = cursor.getDay();
    const monDay = jsDay === 0 ? 6 : jsDay - 1;

    if (weekdays.includes(monDay)) {
      dates.push(new Date(cursor));
      if (endType === "count" && dates.length >= endCount!) break;
      if (dates.length >= 52) break; // hard cap
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

// ── Auth guard ─────────────────────────────────────────────────────────────

async function requireEventManager() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canViewAllPeople(activeRole as Role))
    return { error: "Permission denied." } as const;

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! } as const;

  return { session, campaignId: activeCampaignId } as const;
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createEvent(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await requireEventManager();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Event name is required." };

  const dateStr = formData.get("date") as string;
  const startTime = (formData.get("startTime") as string)?.trim();
  if (!dateStr) return { error: "Date is required." };
  if (!startTime) return { error: "Start time is required." };

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return { error: "Invalid date." };

  const endTime = (formData.get("endTime") as string)?.trim() || null;
  const location = (formData.get("location") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const eventType = parseEventType(formData.get("eventType") as string);
  const canvassListId = (formData.get("canvassListId") as string)?.trim() || null;

  const isRecurring = formData.get("recurring") === "true";

  if (isRecurring) {
    // ── Recurring: generate series ─────────────────────────────────────────
    const weekdays: number[] = [];
    for (let i = 0; i < 7; i++) {
      if (formData.get(`weekday_${i}`) === "on") weekdays.push(i);
    }
    if (weekdays.length === 0)
      return { error: "Select at least one weekday for recurring events." };

    const endType = (formData.get("endType") as string) === "date" ? "date" : "count";

    let endDate: Date | null = null;
    let endCount: number | null = null;

    if (endType === "date") {
      const endDateStr = (formData.get("endDate") as string)?.trim();
      if (!endDateStr) return { error: "End date is required." };
      endDate = new Date(endDateStr);
      if (isNaN(endDate.getTime())) return { error: "Invalid end date." };
      const maxEnd = new Date(date);
      maxEnd.setFullYear(maxEnd.getFullYear() + 1);
      if (endDate > maxEnd) return { error: "End date cannot be more than 1 year from the start date." };
      if (endDate < date) return { error: "End date must be on or after the start date." };
    } else {
      const countStr = (formData.get("endCount") as string)?.trim();
      const count = parseInt(countStr, 10);
      if (isNaN(count) || count < 1) return { error: "Number of occurrences must be at least 1." };
      if (count > 52) return { error: "Maximum 52 occurrences per series." };
      endCount = count;
    }

    const dates = generateRecurringDates(date, weekdays, endType, endDate, endCount);
    if (dates.length === 0)
      return { error: "No occurrences generated. Check the date range and selected weekdays." };

    const seriesId = randomUUID();

    await db.event.createMany({
      data: dates.map((d) => ({
        campaignId,
        name,
        description,
        date: d,
        startTime,
        endTime,
        location,
        eventType,
        status: "upcoming" as EventStatus,
        canvassListId: canvassListId || null,
        seriesId,
        createdById: session.user.id,
      })),
    });

    await createAuditLog({
      campaignId,
      userId: session.user.id,
      action: "event_series_created",
      entityType: "event_series",
      entityId: seriesId,
      details: { name, count: dates.length, weekdays, endType, seriesId },
    });

    revalidatePath("/events");
    redirect("/events");
  }

  // ── Non-recurring: single event ────────────────────────────────────────
  const event = await db.event.create({
    data: {
      campaignId,
      name,
      description,
      date,
      startTime,
      endTime,
      location,
      eventType,
      status: "upcoming",
      canvassListId: canvassListId || null,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  revalidatePath("/events");
  redirect(`/events/${event.id}`);
}

// ── Copy event ─────────────────────────────────────────────────────────────

export async function copyEvent(
  sourceEventId: string,
  formData: FormData
): Promise<{ error?: string; newEventId?: string }> {
  const auth = await requireEventManager();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  const source = await db.event.findFirst({
    where: { id: sourceEventId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!source) return { error: "Source event not found." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Event name is required." };

  const dateStr = formData.get("date") as string;
  const startTime = (formData.get("startTime") as string)?.trim();
  if (!dateStr) return { error: "Date is required." };
  if (!startTime) return { error: "Start time is required." };

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return { error: "Invalid date." };

  const endTime = (formData.get("endTime") as string)?.trim() || null;
  const location = (formData.get("location") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const eventType = parseEventType(formData.get("eventType") as string);
  const canvassListId = (formData.get("canvassListId") as string)?.trim() || null;

  const newEvent = await db.event.create({
    data: {
      campaignId,
      name,
      description,
      date,
      startTime,
      endTime,
      location,
      eventType,
      status: "upcoming",
      canvassListId: canvassListId || null,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "event_copied",
    entityType: "event",
    entityId: newEvent.id,
    details: { sourceEventId },
  });

  revalidatePath("/events");
  return { newEventId: newEvent.id };
}

// ── Update status ──────────────────────────────────────────────────────────

export async function updateEventStatus(
  eventId: string,
  status: EventStatus
): Promise<{ error?: string }> {
  const auth = await requireEventManager();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const event = await db.event.findFirst({
    where: { id: eventId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!event) return { error: "Event not found." };

  await db.event.update({ where: { id: eventId }, data: { status } });
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  return {};
}

// ── Check in attendee ──────────────────────────────────────────────────────

export async function checkInAttendee(
  attendeeId: string,
  eventId: string
): Promise<{ error?: string }> {
  const auth = await requireEventManager();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const attendee = await db.eventAttendee.findFirst({
    where: { id: attendeeId, event: { campaignId }, deletedAt: null },
    select: { id: true },
  });
  if (!attendee) return { error: "Attendee not found." };

  await db.eventAttendee.update({
    where: { id: attendeeId },
    data: { status: "attended", checkedInAt: new Date() },
  });

  revalidatePath(`/events/${eventId}`);
  return {};
}

// ── Add attendee ────────────────────────────────────────────────────────────

export async function addAttendee(
  eventId: string,
  userId: string
): Promise<{ error?: string }> {
  const auth = await requireEventManager();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const event = await db.event.findFirst({
    where: { id: eventId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!event) return { error: "Event not found." };

  const existing = await db.eventAttendee.findFirst({
    where: { eventId, userId, deletedAt: null },
    select: { id: true },
  });
  if (existing) return { error: "Already added." };

  await db.eventAttendee.create({
    data: { eventId, userId, status: "confirmed" },
  });

  revalidatePath(`/events/${eventId}`);
  return {};
}

// ── Remove attendee ─────────────────────────────────────────────────────────

export async function removeAttendee(
  attendeeId: string,
  eventId: string
): Promise<{ error?: string }> {
  const auth = await requireEventManager();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  await db.eventAttendee.updateMany({
    where: { id: attendeeId, event: { campaignId } },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/events/${eventId}`);
  return {};
}

// ── Delete event ────────────────────────────────────────────────────────────

export async function deleteEvent(eventId: string): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") {
    return { error: "Permission denied." };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  await db.event.updateMany({
    where: { id: eventId, campaignId: activeCampaignId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/events");
  redirect("/events");
}

// ── Self-service RSVP (any authenticated campaign member) ──────────────────

export async function rsvpToEvent(
  eventId: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };

  const event = await db.event.findFirst({
    where: { id: eventId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!event) return { error: "Event not found." };

  const existing = await db.eventAttendee.findFirst({
    where: { eventId, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (existing) return { error: "Already RSVP'd." };

  await db.eventAttendee.create({
    data: { eventId, userId: session.user.id, status: "confirmed" },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  return {};
}

// ── Cancel RSVP ───────────────────────────────────────────────────────────────

export async function cancelRsvp(
  eventId: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };

  await db.eventAttendee.updateMany({
    where: {
      eventId,
      userId: session.user.id,
      event: { campaignId: activeCampaignId },
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  return {};
}
