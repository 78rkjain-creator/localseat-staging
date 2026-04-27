import { db } from "@/lib/db";

export type ElectionType = "federal" | "provincial" | "municipal";

export interface VotingRecord {
  id: string;
  campaignId: string;
  personId: string;
  electionType: ElectionType;
  electionYear: number;
  electionName: string | null;
  participated: boolean;
  partySupport: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getVotingRecordsForPerson(
  personId: string,
  campaignId: string
): Promise<VotingRecord[]> {
  return db.votingRecord.findMany({
    where: { personId, campaignId, deletedAt: null },
    orderBy: [{ electionYear: "desc" }, { electionType: "asc" }],
  });
}

export async function addVotingRecord(
  campaignId: string,
  personId: string,
  data: {
    electionType: ElectionType;
    electionYear: number;
    electionName?: string;
    participated: boolean;
    partySupport?: string;
    notes?: string;
  }
): Promise<VotingRecord> {
  return db.votingRecord.create({
    data: { campaignId, personId, ...data },
  });
}

export async function updateVotingRecord(
  id: string,
  campaignId: string,
  data: Partial<{
    electionType: ElectionType;
    electionYear: number;
    electionName: string | null;
    participated: boolean;
    partySupport: string | null;
    notes: string | null;
  }>
): Promise<VotingRecord> {
  return db.votingRecord.update({
    where: { id },
    data,
  });
}

export async function deleteVotingRecord(
  id: string,
  campaignId: string
): Promise<void> {
  // Verify it belongs to this campaign before soft-deleting
  const record = await db.votingRecord.findFirst({
    where: { id, campaignId, deletedAt: null },
  });
  if (!record) return;
  await db.votingRecord.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export interface VotingRecordImportRow {
  personId: string;
  electionType: ElectionType;
  electionYear: number;
  electionName?: string;
  participated: boolean;
  partySupport?: string;
  notes?: string;
}

export async function importVotingRecords(
  campaignId: string,
  rows: VotingRecordImportRow[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    // Skip if a record already exists for this person + year + type
    const existing = await db.votingRecord.findFirst({
      where: {
        campaignId,
        personId: row.personId,
        electionYear: row.electionYear,
        electionType: row.electionType,
        deletedAt: null,
      },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await db.votingRecord.create({
      data: { campaignId, ...row },
    });
    imported++;
  }

  return { imported, skipped };
}

export const ELECTION_TYPE_LABELS: Record<ElectionType, string> = {
  federal: "Federal",
  provincial: "Provincial",
  municipal: "Municipal",
};
