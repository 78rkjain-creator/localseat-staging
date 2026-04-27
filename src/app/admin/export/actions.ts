"use server";

import { db } from "@/lib/db";
import { requireSuperUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { formatAuditDescription } from "@/lib/audit-descriptions";
import { Role } from "@prisma/client";
import type { SupportLevel } from "@/types";

// ── Result type ───────────────────────────────────────────────────────────────

export interface ExportResult {
  csv?: string;
  filename?: string;
  error?: string;
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function esc(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(esc).join(","),
    ...rows.map((row) => row.map(esc).join(",")),
  ].join("\r\n");
}

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// ── Voters export ─────────────────────────────────────────────────────────────

export async function exportVoters(input: {
  campaignId?: string;
  city?: string;
  supportLevel?: SupportLevel;
  tagIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}): Promise<ExportResult> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const people = await db.person.findMany({
    where: {
      deletedAt: null,
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input.supportLevel ? { supportLevel: input.supportLevel } : {}),
      ...(input.tagIds?.length
        ? { tags: { some: { tagId: { in: input.tagIds }, deletedAt: null } } }
        : {}),
      ...(input.city
        ? { household: { address: { city: { contains: input.city, mode: "insensitive" as const } } } }
        : {}),
      ...((input.dateFrom || input.dateTo)
        ? {
            createdAt: {
              ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
              ...(input.dateTo ? { lte: endOfDay(input.dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      campaign: { select: { name: true } },
      household: {
        include: {
          address: {
            select: { streetNumber: true, streetName: true, unitNumber: true, city: true },
          },
        },
      },
      tags: {
        where: { deletedAt: null },
        include: { tag: { select: { name: true } } },
      },
    },
    orderBy: [{ campaign: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
  });

  const headers = [
    "First Name", "Last Name", "Email", "Phone Home", "Phone Mobile",
    "Address", "City", "Household", "Support Level", "Tags",
    "Campaign", "Created At",
  ];

  const rows = people.map((p) => {
    const addr = p.household?.address;
    const addressStr = addr
      ? [addr.streetNumber, addr.streetName, addr.unitNumber].filter(Boolean).join(" ")
      : "";
    const cityStr = addr?.city ?? "";
    const tagsStr = p.tags.map((t) => t.tag.name).join("; ");
    return [
      p.firstName, p.lastName, p.email ?? "", p.phoneHome ?? "", p.phoneMobile ?? "",
      addressStr, cityStr, p.household?.name ?? "", p.supportLevel ?? "", tagsStr,
      p.campaign.name, p.createdAt.toISOString(),
    ];
  });

  await createAuditLog({
    userId: auth.session.user.id,
    action: "EXPORT_ADMIN_VOTERS",
    entityType: "export",
    entityId: "voters",
    details: { exportType: "voters", filters: input, rowCount: people.length, format: "csv" },
  });

  return {
    csv: buildCsv(headers, rows),
    filename: `voters-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

// ── Campaigns export ──────────────────────────────────────────────────────────

export async function exportCampaigns(input: {
  status?: "active" | "inactive" | "deleted";
  municipality?: string;
  city?: string;
  electionDateFrom?: string;
  electionDateTo?: string;
}): Promise<ExportResult> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const statusFilter =
    input.status === "deleted"
      ? { deletedAt: { not: null as null } }
      : input.status === "active"
        ? { deletedAt: null, isActive: true }
        : input.status === "inactive"
          ? { deletedAt: null, isActive: false }
          : {};

  const campaigns = await db.campaign.findMany({
    where: {
      ...statusFilter,
      ...(input.municipality
        ? { municipality: { contains: input.municipality, mode: "insensitive" as const } }
        : {}),
      ...(input.city
        ? { city: { contains: input.city, mode: "insensitive" as const } }
        : {}),
      ...((input.electionDateFrom || input.electionDateTo)
        ? {
            electionDate: {
              ...(input.electionDateFrom ? { gte: new Date(input.electionDateFrom) } : {}),
              ...(input.electionDateTo ? { lte: endOfDay(input.electionDateTo) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Name", "Municipality", "City", "Wards", "Office Sought",
    "Ballot Name", "Election Date", "Status", "Created At",
  ];

  const rows = campaigns.map((c) => {
    const status = c.deletedAt ? "Deleted" : c.isActive ? "Active" : "Inactive";
    return [
      c.name,
      c.municipality ?? "",
      c.city,
      c.wards.join("; "),
      c.officeSought ?? "",
      c.ballotName ?? "",
      c.electionDate ? c.electionDate.toISOString().slice(0, 10) : "",
      status,
      c.createdAt.toISOString(),
    ];
  });

  await createAuditLog({
    userId: auth.session.user.id,
    action: "EXPORT_ADMIN_CAMPAIGNS",
    entityType: "export",
    entityId: "campaigns",
    details: { exportType: "campaigns", filters: input, rowCount: campaigns.length, format: "csv" },
  });

  return {
    csv: buildCsv(headers, rows),
    filename: `campaigns-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

// ── Users export ──────────────────────────────────────────────────────────────

export async function exportUsers(input: {
  platformRole?: string;
  campaignRole?: string;
  campaignId?: string;
  status?: "active" | "deactivated";
  city?: string;
}): Promise<ExportResult> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const platformRoleFilter =
    input.platformRole === "super_user"
      ? { platformRole: "super_user" }
      : input.platformRole === "super_admin"
        ? { platformRole: "super_admin" }
        : input.platformRole === "none"
          ? { platformRole: null }
          : {};

  const membershipWhere: Record<string, unknown> = { deletedAt: null };
  if (input.campaignId) membershipWhere.campaignId = input.campaignId;
  if (input.campaignRole && Object.values(Role).includes(input.campaignRole as Role)) {
    membershipWhere.role = input.campaignRole as Role;
  }
  if (input.city) {
    membershipWhere.campaign = { city: { contains: input.city, mode: "insensitive" } };
  }

  const hasMembershipFilter = !!(input.campaignId || input.campaignRole || input.city);

  const users = await db.user.findMany({
    where: {
      deletedAt: null,
      ...platformRoleFilter,
      ...(input.status === "active" ? { isActive: true } : {}),
      ...(input.status === "deactivated" ? { isActive: false } : {}),
      ...(hasMembershipFilter ? { memberships: { some: membershipWhere } } : {}),
    },
    include: {
      memberships: {
        where: membershipWhere,
        include: {
          campaign: { select: { name: true, city: true } },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const headers = [
    "Name", "Email", "Platform Role", "Campaign",
    "Campaign Role", "Status", "City", "Created At",
  ];

  const rows: unknown[][] = [];
  for (const user of users) {
    if (user.memberships.length === 0) {
      rows.push([
        `${user.firstName} ${user.lastName}`,
        user.email,
        user.platformRole ?? "",
        "", "",
        user.isActive ? "Active" : "Deactivated",
        "",
        user.createdAt.toISOString(),
      ]);
    } else {
      for (const m of user.memberships) {
        rows.push([
          `${user.firstName} ${user.lastName}`,
          user.email,
          user.platformRole ?? "",
          m.campaign.name,
          m.role,
          user.isActive ? "Active" : "Deactivated",
          m.campaign.city ?? "",
          user.createdAt.toISOString(),
        ]);
      }
    }
  }

  await createAuditLog({
    userId: auth.session.user.id,
    action: "EXPORT_ADMIN_USERS",
    entityType: "export",
    entityId: "users",
    details: { exportType: "users", filters: input, rowCount: rows.length, format: "csv" },
  });

  return {
    csv: buildCsv(headers, rows),
    filename: `users-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

// ── Audit logs export ─────────────────────────────────────────────────────────

export async function exportAuditLogs(input: {
  action?: string;
  userId?: string;
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ExportResult> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const logs = await db.auditLog.findMany({
    where: {
      ...(input.action
        ? { action: { contains: input.action, mode: "insensitive" as const } }
        : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...((input.dateFrom || input.dateTo)
        ? {
            createdAt: {
              ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
              ...(input.dateTo ? { lte: endOfDay(input.dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      campaign: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Timestamp", "Description", "Action", "User Name", "User Email",
    "Campaign", "Entity Type", "Entity ID", "Details",
  ];

  const rows = logs.map((log) => {
    const actorName = log.user ? `${log.user.firstName} ${log.user.lastName}` : "System";
    const metadata =
      log.after && typeof log.after === "object" && !Array.isArray(log.after)
        ? (log.after as Record<string, unknown>)
        : null;
    const description = formatAuditDescription(log.action, metadata, actorName);
    return [
      log.createdAt.toISOString(),
      description,
      log.action,
      actorName !== "System" ? actorName : "",
      log.user?.email ?? "",
      log.campaign?.name ?? "",
      log.entityType,
      log.entityId,
      log.after ? JSON.stringify(log.after) : "",
    ];
  });

  await createAuditLog({
    userId: auth.session.user.id,
    action: "EXPORT_AUDIT_LOG",
    entityType: "export",
    entityId: "audit_logs",
    details: { exportType: "audit_logs", filters: input, rowCount: logs.length, format: "csv" },
  });

  return {
    csv: buildCsv(headers, rows),
    filename: `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}
