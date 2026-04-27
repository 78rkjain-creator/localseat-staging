import { db } from "@/lib/db";
import type { EventType, EventStatus, EventAttendeeStatus } from "@prisma/client";

export type { EventType, EventStatus, EventAttendeeStatus };

// ── Shared shapes ──────────────────────────────────────────────────────────

export interface EventSummary {
  id: string;
  name: string;
  description: string | null;
  date: Date;
  startTime: string;
  endTime: string | null;
  location: string | null;
  eventType: EventType;
  status: EventStatus;
  attendeeCount: number;
}

export interface EventDetail extends EventSummary {
  canvassListId: string | null;
  canvassListName: string | null;
  createdBy: { id: string; firstName: string; lastName: string };
  attendees: {
    id: string;
    status: EventAttendeeStatus;
    checkedInAt: Date | null;
    notes: string | null;
    user: { id: string; firstName: string; lastName: string; email: string };
  }[];
}

// ── Data access ───────────────────────────────────────────────────────────

export async function getUpcomingEvents(campaignId: string): Promise<EventSummary[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events = await db.event.findMany({
    where: { campaignId, deletedAt: null, date: { gte: today } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { _count: { select: { attendees: { where: { deletedAt: null } } } } },
  });

  return events.map(shapeEventSummary);
}

export async function getPastEvents(campaignId: string): Promise<EventSummary[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events = await db.event.findMany({
    where: { campaignId, deletedAt: null, date: { lt: today } },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    include: { _count: { select: { attendees: { where: { deletedAt: null } } } } },
    take: 50,
  });

  return events.map(shapeEventSummary);
}

export async function getEvent(
  eventId: string,
  campaignId: string
): Promise<EventDetail | null> {
  const event = await db.event.findFirst({
    where: { id: eventId, campaignId, deletedAt: null },
    include: {
      _count: { select: { attendees: { where: { deletedAt: null } } } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      canvassList: { select: { name: true } },
      attendees: {
        where: { deletedAt: null },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!event) return null;

  return {
    ...shapeEventSummary(event),
    canvassListId: event.canvassListId,
    canvassListName: event.canvassList?.name ?? null,
    createdBy: event.createdBy,
    attendees: event.attendees.map((a) => ({
      id: a.id,
      status: a.status,
      checkedInAt: a.checkedInAt,
      notes: a.notes,
      user: a.user,
    })),
  };
}

export async function getCampaignMembers(campaignId: string) {
  const memberships = await db.campaignMembership.findMany({
    where: { campaignId, deletedAt: null, user: { isActive: true } },
    select: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      role: true,
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });
  return memberships.map((m) => ({ ...m.user, role: m.role }));
}

// ── Shape helper ──────────────────────────────────────────────────────────

function shapeEventSummary(event: {
  id: string;
  name: string;
  description: string | null;
  date: Date;
  startTime: string;
  endTime: string | null;
  location: string | null;
  eventType: EventType;
  status: EventStatus;
  _count: { attendees: number };
}): EventSummary {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    eventType: event.eventType,
    status: event.status,
    attendeeCount: event._count.attendees,
  };
}
