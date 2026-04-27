import { db } from "@/lib/db";

export interface FieldMessageItem {
  id: string;
  title: string;
  content: string;
  priority: "normal" | "urgent";
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: { firstName: string; lastName: string };
}

export async function getActiveFieldMessages(campaignId: string): Promise<FieldMessageItem[]> {
  const now = new Date();
  const rows = await (db as any).fieldMessage.findMany({
    where: {
      campaignId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      title: true,
      content: true,
      priority: true,
      expiresAt: true,
      createdAt: true,
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return rows as FieldMessageItem[];
}

export async function getAllFieldMessages(campaignId: string): Promise<FieldMessageItem[]> {
  const rows = await (db as any).fieldMessage.findMany({
    where: { campaignId, deletedAt: null },
    select: {
      id: true,
      title: true,
      content: true,
      priority: true,
      expiresAt: true,
      createdAt: true,
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return rows as FieldMessageItem[];
}
