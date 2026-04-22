import { db } from "@/lib/db";

export async function getCompetitors(campaignId: string) {
  return db.campaignCompetitor.findMany({
    where: { campaignId, deletedAt: null },
    select: { id: true, name: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function addCompetitor(campaignId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Competitor name cannot be empty.");
  return db.campaignCompetitor.create({
    data: { campaignId, name: trimmed },
  });
}

export async function updateCompetitor(id: string, campaignId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Competitor name cannot be empty.");
  const existing = await db.campaignCompetitor.findFirst({
    where: { id, campaignId, deletedAt: null },
  });
  if (!existing) throw new Error("Competitor not found.");
  return db.campaignCompetitor.update({
    where: { id },
    data: { name: trimmed },
  });
}

export async function deleteCompetitor(id: string, campaignId: string) {
  const existing = await db.campaignCompetitor.findFirst({
    where: { id, campaignId, deletedAt: null },
  });
  if (!existing) throw new Error("Competitor not found.");
  return db.campaignCompetitor.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
