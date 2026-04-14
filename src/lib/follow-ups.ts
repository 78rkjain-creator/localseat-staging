import { db } from "@/lib/db";

// ── Task shape returned to the UI ──────────────────────────────────────────

export interface FollowUpTask {
  id: string;
  title: string;
  notes: string | null;
  dueDate: Date | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    address: {
      streetNumber: string;
      streetName: string;
      unitNumber: string | null;
      city: string;
    } | null;
  } | null;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

// ── Manager / organizer view: full campaign queue ──────────────────────────

export async function getFullFollowUpQueue(campaignId: string): Promise<{
  unassigned: FollowUpTask[];
  assigned: FollowUpTask[];
}> {
  console.log("[getFullFollowUpQueue] querying campaignId:", campaignId);
  const tasks = await db.task.findMany({
    where: { campaignId, completed: false },
    include: {
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          household: {
            select: {
              address: {
                select: {
                  streetNumber: true,
                  streetName: true,
                  unitNumber: true,
                  city: true,
                },
              },
            },
          },
        },
      },
      assignee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  console.log("[getFullFollowUpQueue] raw task count:", tasks.length, "| ids:", tasks.map(t => t.id));
  const shaped = tasks.map(shapeTask);
  return {
    unassigned: shaped.filter((t) => !t.assignee),
    assigned: shaped.filter((t) => !!t.assignee),
  };
}

// ── Canvasser view: only tasks assigned to them ────────────────────────────

export async function getMyFollowUpTasks(
  userId: string,
  campaignId: string
): Promise<FollowUpTask[]> {
  const tasks = await db.task.findMany({
    where: { campaignId, assignedTo: userId, completed: false },
    include: {
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          household: {
            select: {
              address: {
                select: {
                  streetNumber: true,
                  streetName: true,
                  unitNumber: true,
                  city: true,
                },
              },
            },
          },
        },
      },
      assignee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  return tasks.map(shapeTask);
}

// ── Dashboard summary ──────────────────────────────────────────────────────

export async function getFollowUpSummary(campaignId: string) {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [overdue, dueToday, upcoming] = await Promise.all([
    db.task.findMany({
      where: {
        campaignId,
        completed: false,
        dueDate: { lt: now },
      },
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    db.task.findMany({
      where: {
        campaignId,
        completed: false,
        dueDate: { gte: now, lte: todayEnd },
      },
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    db.task.count({
      where: { campaignId, completed: false, dueDate: { gt: todayEnd } },
    }),
  ]);

  return { overdue, dueToday, upcomingCount: upcoming };
}

// ── Team members available for assignment ──────────────────────────────────

export async function getCampaignTeamMembers(campaignId: string) {
  const memberships = await db.campaignMembership.findMany({
    where: { campaignId, user: { isActive: true } },
    select: {
      user: { select: { id: true, firstName: true, lastName: true } },
      role: true,
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });
  return memberships.map((m) => ({ ...m.user, role: m.role }));
}

// ── Shape helper ──────────────────────────────────────────────────────────

function shapeTask(task: {
  id: string;
  title: string;
  notes: string | null;
  dueDate: Date | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    household: {
      address: {
        streetNumber: string;
        streetName: string;
        unitNumber: string | null;
        city: string;
      } | null;
    } | null;
  } | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
}): FollowUpTask {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    dueDate: task.dueDate,
    completed: task.completed,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    person: task.person
      ? {
          id: task.person.id,
          firstName: task.person.firstName,
          lastName: task.person.lastName,
          address: task.person.household?.address ?? null,
        }
      : null,
    assignee: task.assignee,
  };
}
