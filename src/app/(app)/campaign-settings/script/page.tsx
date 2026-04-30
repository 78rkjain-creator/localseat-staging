import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ScriptFormClient } from "./script-form-client";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Canvassing Script" };

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager", "co_chair"];

export default async function CanvassScriptPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    redirect("/dashboard");
  }

  const campaign = await db.campaign.findUnique({
    where: { id: activeCampaignId },
    select: { canvassScript: true },
  });
  if (!campaign) redirect("/dashboard");

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Canvassing Script</h1>
        <p className="text-slate-500 text-sm mt-1 max-w-xl">
          This script will appear on the canvass screen to guide your canvassers at the door.
        </p>
      </div>

      <ScriptFormClient initialScript={campaign.canvassScript} />
    </div>
  );
}
