"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { checkSupportWriteAccess } from "@/lib/support-access";
import { Prisma } from "@prisma/client";

export interface GeneralSettingsState {
  error?: string;
  success?: boolean;
}

export async function saveGeneralSettings(
  _prev: GeneralSettingsState,
  formData: FormData
): Promise<GeneralSettingsState> {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") redirect("/dashboard");

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Campaign name is required." };

  const electionDateRaw = formData.get("electionDate") as string | null;
  const fundraisingGoalRaw = formData.get("fundraisingGoal") as string | null;

  const electionDate = electionDateRaw?.trim()
    ? new Date(`${electionDateRaw.trim()}T00:00:00.000Z`)
    : null;

  const parsedGoal = fundraisingGoalRaw?.trim()
    ? parseInt(fundraisingGoalRaw.trim(), 10)
    : NaN;
  const fundraisingGoal = !isNaN(parsedGoal) ? Math.max(0, parsedGoal) : null;

  // Advance voting dates — submitted as indexed pairs: advanceDate_0, advanceTime_0, …
  const countRaw = formData.get("advanceDateCount") as string | null;
  const count = parseInt(countRaw ?? "0", 10) || 0;
  const advanceVotingDates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const dateStr = (formData.get(`advanceDate_${i}`) as string | null)?.trim();
    const timeStr = (formData.get(`advanceTime_${i}`) as string | null)?.trim() || "00:00";
    if (dateStr) {
      const d = new Date(`${dateStr}T${timeStr}:00.000Z`);
      if (!isNaN(d.getTime())) advanceVotingDates.push(d);
    }
  }
  advanceVotingDates.sort((a, b) => a.getTime() - b.getTime());

  // Office address — structured fields from hidden inputs
  const officeStreetNumber = (formData.get("officeStreetNumber") as string | null)?.trim() || null;
  const officeStreetName   = (formData.get("officeStreetName")   as string | null)?.trim() || null;
  const officeUnitNumber   = (formData.get("officeUnitNumber")   as string | null)?.trim() || null;
  const officeCity         = (formData.get("officeCity")         as string | null)?.trim() || null;
  const officeProvince     = (formData.get("officeProvince")     as string | null)?.trim() || null;
  const officePostalCode   = (formData.get("officePostalCode")   as string | null)?.trim() || null;
  const officeAddressId    = (formData.get("officeAddressId")    as string | null)?.trim() || null;
  const officeLatRaw       = (formData.get("officeAddressLat")   as string | null)?.trim() || null;
  const officeLngRaw       = (formData.get("officeAddressLng")   as string | null)?.trim() || null;

  const hasOfficeAddress = !!(officeStreetNumber && officeStreetName);

  let officeLat: number | null = null;
  let officeLng: number | null = null;

  if (hasOfficeAddress) {
    if (officeLatRaw && officeLngRaw) {
      const parsedLat = parseFloat(officeLatRaw);
      const parsedLng = parseFloat(officeLngRaw);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        officeLat = parsedLat;
        officeLng = parsedLng;
      }
    } else if (officeAddressId) {
      const addr = await db.address.findUnique({
        where: { id: officeAddressId },
        select: { lat: true, lng: true },
      });
      if (addr?.lat != null && addr?.lng != null) {
        officeLat = addr.lat;
        officeLng = addr.lng;
      }
    }
  }

  const municipalityName = (formData.get("municipalityName") as string | null)?.trim() || null;
  const municipalityId   = (formData.get("municipalityId")   as string | null)?.trim() || null;
  const boundaryRaw      = (formData.get("municipalityBoundary") as string | null)?.trim() || null;

  let municipalityBoundary: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
  if (boundaryRaw) {
    try {
      municipalityBoundary = JSON.parse(boundaryRaw) as Prisma.InputJsonValue;
    } catch {
      // ignore malformed boundary — don't block save
    }
  }

  try {
    await db.campaign.update({
      where: { id: activeCampaignId },
      data: {
        name,
        electionDate,
        fundraisingGoal,
        advanceVotingDates,
        officeAddressStreetNumber: hasOfficeAddress ? officeStreetNumber : null,
        officeAddressStreetName:   hasOfficeAddress ? officeStreetName   : null,
        officeAddressUnitNumber:   hasOfficeAddress ? (officeUnitNumber  || null) : null,
        officeAddressCity:         hasOfficeAddress ? officeCity         : null,
        officeAddressProvince:     hasOfficeAddress ? officeProvince     : null,
        officeAddressPostalCode:   hasOfficeAddress ? officePostalCode   : null,
        officeAddressLat:          hasOfficeAddress ? officeLat          : null,
        officeAddressLng:          hasOfficeAddress ? officeLng          : null,
        municipalityName,
        municipalityId,
        municipalityBoundary,
      },
    });
  } catch {
    return { error: "Failed to save settings. Please try again." };
  }

  revalidatePath("/campaign-settings/general");
  revalidatePath("/dashboard");
  return { success: true };
}
