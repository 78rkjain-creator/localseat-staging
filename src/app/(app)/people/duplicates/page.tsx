import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageVoterList } from "@/lib/permissions";
import { DuplicatesUi } from "./duplicates-ui";
import { BackLink } from "@/components/ui/back-link";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Duplicate Records" };

export default async function DuplicatesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canManageVoterList(activeRole as Role)) redirect("/import");

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      <BackLink fallbackHref="/import" label="Back to Import & Data Management" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Duplicate Records</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Configure matching rules, search for duplicates, then merge or dismiss each group.
        </p>
      </div>

      <DuplicatesUi />
    </div>
  );
}
