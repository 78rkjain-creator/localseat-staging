"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

interface CreateCampaignInput {
  name: string;
  ballotName?: string;
  officeSought?: string;
  province?: string;
  campaignElectionType?: string;
  municipality?: string;
  wardsInput?: string;
  electionDate?: string;
  municipalityName?: string;
  municipalityId?: string;
  municipalityBoundary?: string; // JSON string
}

/**
 * Creates a PendingCampaign record instead of a real Campaign.
 * The real Campaign is only created when payment succeeds (Stripe webhook).
 * Pending records expire after 48 hours if never paid.
 */
export async function createCampaign(
  input: CreateCampaignInput
): Promise<{ error?: string; pendingId?: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Not authenticated." };
  }

  const name = input.name.trim();
  if (!name) {
    return { error: "Campaign name is required." };
  }

  const ballotName = input.ballotName?.trim() || null;
  const officeSought = input.officeSought?.trim() || null;
  const provinceInput = input.province?.trim() || "";
  if (!provinceInput) {
    return { error: "Province is required." };
  }
  const validProvinces = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];
  if (!validProvinces.includes(provinceInput)) {
    return { error: "Invalid province." };
  }
  const validElectionTypes = ["municipal","provincial_nomination","provincial","federal_nomination","federal"];
  const electionTypeInput = input.campaignElectionType?.trim() || "municipal";
  if (!validElectionTypes.includes(electionTypeInput)) {
    return { error: "Invalid election type." };
  }
  const municipality = input.municipality?.trim() || null;
  const wards = (input.wardsInput ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  const electionDate = input.electionDate ? new Date(input.electionDate) : null;
  const year = electionDate ? electionDate.getFullYear() : new Date().getFullYear();

  const municipalityName = input.municipalityName?.trim() || null;
  const municipalityId   = input.municipalityId?.trim() || null;
  let municipalityBoundary: object | null = null;
  if (input.municipalityBoundary?.trim()) {
    try {
      municipalityBoundary = JSON.parse(input.municipalityBoundary);
    } catch { /* ignore malformed boundary */ }
  }

  const cityValue = municipalityName ?? municipality;

  // Pending campaigns expire after 48 hours if never paid
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const pending = await db.pendingCampaign.create({
    data: {
      userId: session.user.id,
      name,
      ...(ballotName ? { ballotName } : {}),
      ...(officeSought ? { officeSought } : {}),
      ...(cityValue ? { municipality: cityValue, city: cityValue } : { city: "" }),
      ...(municipalityName ? { municipalityName } : {}),
      ...(municipalityId ? { municipalityId } : {}),
      ...(municipalityBoundary ? { municipalityBoundary } : {}),
      wards,
      province: provinceInput,
      year,
      ...(electionDate ? { electionDate } : {}),
      campaignElectionType: electionTypeInput as "municipal" | "provincial_nomination" | "provincial" | "federal_nomination" | "federal",
      expiresAt,
    },
  });

  return { pendingId: pending.id };
}

// ── Fetch known election dates from PlatformSettings ──────────────────────

export async function getElectionDates(): Promise<Record<string, string>> {
  const rows = await db.platformSettings.findMany({
    where: { key: { startsWith: "election_date_" } },
    select: { key: true, value: true },
  });
  const result: Record<string, string> = {};
  for (const row of rows) {
    const suffix = row.key.replace("election_date_", "");
    if (suffix && row.value) {
      result[suffix] = row.value;
    }
  }
  return result;
}
