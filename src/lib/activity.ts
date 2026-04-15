import { db } from "@/lib/db";
import { OUTREACH_CHANNEL_LABELS, SUPPORT_LEVEL_LABELS } from "@/types";
import type { OutreachChannel, SupportLevel } from "@/types";

export type ActivityType = "canvass" | "note" | "outreach";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  description: string;
  performedBy: string;
  createdAt: Date;
}

export async function getRecentActivity(
  campaignId: string,
  limit: number = 20
): Promise<ActivityEntry[]> {
  // Fetch from all three sources in parallel, over-fetching so the final sort
  // has enough candidates to fill the requested limit after merging.
  const fetchSize = limit * 3;

  const [outreachLogs, canvassResponses, notes] = await Promise.all([
    // Outreach logs — directly campaign-scoped
    db.outreachLog.findMany({
      where: { campaignId, deletedAt: null },
      include: {
        person: { select: { firstName: true, lastName: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: fetchSize,
    }),

    // Canvass responses — scoped via canvass list
    db.canvassResponse.findMany({
      where: {
        assignment: { canvassList: { campaignId } },
      },
      include: {
        person: { select: { firstName: true, lastName: true } },
        assignment: {
          include: {
            canvasser: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { respondedAt: "desc" },
      take: fetchSize,
    }),

    // Notes — scoped via person
    db.note.findMany({
      where: { deletedAt: null, person: { campaignId } },
      include: {
        person: { select: { firstName: true, lastName: true } },
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: fetchSize,
    }),
  ]);

  const entries: ActivityEntry[] = [];

  for (const log of outreachLogs) {
    const personName = log.person
      ? `${log.person.firstName} ${log.person.lastName}`
      : "Unknown";
    const channel =
      OUTREACH_CHANNEL_LABELS[log.channel as OutreachChannel] ?? log.channel;
    const performedBy = log.user
      ? `${log.user.firstName} ${log.user.lastName}`
      : "System";

    entries.push({
      id: `outreach-${log.id}`,
      type: "outreach",
      description: `${channel} outreach logged for ${personName}${log.outcome ? ` — ${log.outcome}` : ""}`,
      performedBy,
      createdAt: log.createdAt,
    });
  }

  for (const response of canvassResponses) {
    const personName = `${response.person.firstName} ${response.person.lastName}`;
    const canvasserName = `${response.assignment.canvasser.firstName} ${response.assignment.canvasser.lastName}`;
    const levelLabel = response.supportLevel
      ? SUPPORT_LEVEL_LABELS[response.supportLevel as SupportLevel]
      : null;
    const description = levelLabel
      ? `Canvassed ${personName} — ${levelLabel}`
      : `Door knock recorded for ${personName}`;

    entries.push({
      id: `canvass-${response.id}`,
      type: "canvass",
      description,
      performedBy: canvasserName,
      createdAt: response.respondedAt,
    });
  }

  for (const note of notes) {
    const personName = `${note.person.firstName} ${note.person.lastName}`;
    const authorName = `${note.author.firstName} ${note.author.lastName}`;

    entries.push({
      id: `note-${note.id}`,
      type: "note",
      description: `Note added for ${personName}`,
      performedBy: authorName,
      createdAt: note.createdAt,
    });
  }

  // Sort descending by date, then take the requested limit
  entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return entries.slice(0, limit);
}
