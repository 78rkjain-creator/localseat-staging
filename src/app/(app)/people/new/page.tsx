import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAddResident } from "@/lib/permissions";
import { getCampaignTags } from "@/lib/people";
import { AddResidentForm } from "./add-resident-form";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Add resident" };

export default async function AddResidentPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canAddResident(activeRole as Role)) redirect("/people/residents");

  const tags = await getCampaignTags(activeCampaignId);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/people/residents"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Residents List
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Add resident</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Manually added residents are excluded from walk lists by default.
        </p>
      </div>

      <AddResidentForm tags={tags} />
    </div>
  );
}
