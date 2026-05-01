import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NewEventForm } from "./new-event-form";
import type { Role } from "@/types";
import { canViewAllPeople } from "@/lib/permissions";
import { isEventsEnabled } from "@/lib/plan-limits";
import { UpgradeCard } from "@/components/upgrade-card";
import { FEATURE_METADATA } from "@/lib/feature-metadata";

export const metadata: Metadata = { title: "New Event" };

export default async function NewEventPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (
    !activeRole ||
    !canViewAllPeople(activeRole as Role) ||
    activeRole === "canvasser"
  ) {
    redirect("/events");
  }

  if (!await isEventsEnabled(activeCampaignId)) {
    const meta = FEATURE_METADATA["events"];
    return (
      <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
        <UpgradeCard
          featureName={meta.name}
          featureDescription={meta.description}
          requiredPlan={meta.requiredPlan}
          campaignId={activeCampaignId}
        />
      </div>
    );
  }

  const lists = await db.canvassList.findMany({
    where: { campaignId: activeCampaignId, deletedAt: null, status: { in: ["active", "draft"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New event</h1>
        <p className="text-slate-500 text-sm mt-0.5">Schedule a campaign activity</p>
      </div>

      <NewEventForm lists={lists} today={today} />
    </div>
  );
}
