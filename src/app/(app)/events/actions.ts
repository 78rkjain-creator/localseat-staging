"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canViewAllPeople } from "@/lib/permissions";
import type { Role } from "@/types";
import type { EventType, EventStatus, EventAttendeeStatus } from "@prisma/client";

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

// ── Create ─────────────────────────────────────────────────────────────────

export async function createEvent(formData: FormData): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canViewAllPeople(activeRole as Role)) return { error: "Permission denied." };

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

  const event = await db.event.create({
    data: {
      campaignId: activeCampaignId,
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

// ── Update status ──────────────────────────────────────────────────────────

export async function updateEventStatus(
  eventId: string,
  status: EventStatus
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canViewAllPeople(activeRole as Role)) return { error: "Permission denied." };

  const event = await db.event.findFirst({
    where: { id: eventId, campaignId: activeCampaignId, deletedAt: null },
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
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canViewAllPeople(activeRole as Role)) return { error: "Permission denied." };

  const attendee = await db.eventAttendee.findFirst({
    where: { id: attendeeId, event: { campaignId: activeCampaignId }, deletedAt: null },
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
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canViewAllPeople(activeRole as Role)) return { error: "Permission denied." };

  const event = await db.event.findFirst({
    where: { id: eventId, campaignId: activeCampaignId, deletedAt: null },
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
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canViewAllPeople(activeRole as Role)) return { error: "Permission denied." };

  await db.eventAttendee.updateMany({
    where: { id: attendeeId, event: { campaignId: activeCampaignId } },
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
  if (activeRole !== "candidate" && activeRole !== "campaign_manager") {
    return { error: "Permission denied." };
  }

  await db.event.updateMany({
    where: { id: eventId, campaignId: activeCampaignId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/events");
  redirect("/events");
}
