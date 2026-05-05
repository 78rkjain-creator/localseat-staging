"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export interface LeadFilters {
  search?:    string;
  emailed?:   "all" | "emailed" | "not_emailed";
  officeType?: string;
  dateFrom?:  string; // ISO date string
  dateTo?:    string; // ISO date string
}

export interface DemoLead {
  email:          string;
  firstName:      string;
  lastName:       string;
  phone:          string | null;
  municipality:   string | null;
  officeType:     string | null;
  registrations:  number;
  firstSeenAt:    Date;
  lastSeenAt:     Date;
  emailedAt:      Date | null;
  consented:      boolean;
  source:         "demo" | "app";
  converted:      boolean;
}

export async function getDemoLeads(filters: LeadFilters = {}): Promise<DemoLead[]> {
  const auth = await requireSuperUser();
  if ("error" in auth) throw new Error(auth.error);

  const { search, emailed, officeType, dateFrom, dateTo } = filters;

  // Fetch all registrations then group in-process — DemoRegistration has no
  // foreign keys so a single query is fine at lead volumes.
  const rows = await db.demoRegistration.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Group by email
  const byEmail = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.email.toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key)!.push(row);
  }

  // Resolve conversion status: email matches a user with at least one paid campaign
  const allEmails = Array.from(byEmail.keys());
  const convertedUsers = allEmails.length > 0
    ? await db.user.findMany({
        where: {
          email: { in: allEmails },
          memberships: {
            some: {
              deletedAt: null,
              campaign: { planActivated: true, plan: { not: "demo" } },
            },
          },
        },
        select: { email: true },
      })
    : [];
  const convertedEmails = new Set(convertedUsers.map((u) => u.email.toLowerCase()));

  const leads: DemoLead[] = Array.from(byEmail.values()).map((group) => {
    const latest = group[0];
    const sorted = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const emailKey = latest.email.toLowerCase();
    return {
      email:         latest.email,
      firstName:     latest.firstName,
      lastName:      latest.lastName,
      phone:         latest.phone,
      municipality:  latest.municipality,
      officeType:    latest.officeType,
      registrations: group.length,
      firstSeenAt:   sorted[0].createdAt,
      lastSeenAt:    sorted[sorted.length - 1].createdAt,
      emailedAt:     group.find((r) => r.emailedAt)?.emailedAt ?? null,
      consented:     group.some((r) => r.consented),
      source:        group.some((r) => r.source === "app" || r.source === "app_signup") ? "app" : "demo",
      converted:     convertedEmails.has(emailKey),
    };
  });

  // Apply filters
  return leads.filter((lead) => {
    if (search) {
      const q = search.toLowerCase();
      const matches =
        lead.firstName.toLowerCase().includes(q) ||
        lead.lastName.toLowerCase().includes(q)  ||
        lead.email.toLowerCase().includes(q)     ||
        (lead.municipality?.toLowerCase().includes(q) ?? false);
      if (!matches) return false;
    }

    if (emailed === "emailed"     && !lead.emailedAt) return false;
    if (emailed === "not_emailed" &&  lead.emailedAt) return false;

    if (officeType && lead.officeType !== officeType) return false;

    if (dateFrom) {
      const from = new Date(dateFrom);
      if (lead.firstSeenAt < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (lead.lastSeenAt > to) return false;
    }

    return true;
  });
}

export async function markAsEmailed(email: string): Promise<void> {
  const auth = await requireSuperUser();
  if ("error" in auth) throw new Error(auth.error);
  const now = new Date();

  await db.demoRegistration.updateMany({
    where: { email: email.toLowerCase() },
    data:  { emailedAt: now },
  });

  await createAuditLog({
    userId:     auth.session.user.id,
    action:     "DEMO_LEAD_EMAILED",
    entityType: "demo_registration",
    entityId:   email.toLowerCase(),
    details:    { email, emailedAt: now.toISOString(), action: "marked" },
  });
}

export async function unmarkAsEmailed(email: string): Promise<void> {
  const auth = await requireSuperUser();
  if ("error" in auth) throw new Error(auth.error);

  await db.demoRegistration.updateMany({
    where: { email: email.toLowerCase() },
    data:  { emailedAt: null },
  });

  await createAuditLog({
    userId:     auth.session.user.id,
    action:     "DEMO_LEAD_EMAILED",
    entityType: "demo_registration",
    entityId:   email.toLowerCase(),
    details:    { email, emailedAt: null, action: "unmarked" },
  });
}

export async function deleteDemoLeads(emails: string[]): Promise<{ error?: string; deleted?: number }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return { error: auth.error };
  if (emails.length === 0) return { deleted: 0 };

  const normalizedEmails = emails.map((e) => e.toLowerCase());

  const result = await db.demoRegistration.deleteMany({
    where: { email: { in: normalizedEmails } },
  });

  await createAuditLog({
    userId:     auth.session.user.id,
    action:     "DEMO_LEAD_DELETED",
    entityType: "demo_registration",
    entityId:   normalizedEmails.join(","),
    details:    { emails: normalizedEmails, count: emails.length },
  });

  revalidatePath("/admin/demo-leads");
  return { deleted: result.count };
}

export async function exportDemoLeadsCSV(filters: LeadFilters = {}): Promise<string> {
  const auth = await requireSuperUser();
  if ("error" in auth) throw new Error(auth.error);
  const leads = await getDemoLeads(filters);

  const header = "Email,First Name,Last Name,Phone,Municipality,Office,Registrations,First Seen,Last Seen,Emailed,Consented,Source,Converted";
  const rows = leads.map((l) =>
    [
      l.email,
      l.firstName,
      l.lastName,
      l.phone        ?? "",
      l.municipality ?? "",
      l.officeType   ?? "",
      l.registrations,
      l.firstSeenAt.toISOString(),
      l.lastSeenAt.toISOString(),
      l.emailedAt ? l.emailedAt.toISOString() : "",
      l.consented ? "yes" : "no",
      l.source,
      l.converted ? "yes" : "no",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );

  return [header, ...rows].join("\n");
}
