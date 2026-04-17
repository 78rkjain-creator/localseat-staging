import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canReviewAddressChanges } from "@/lib/permissions";
import { getPendingAddressChangeRequests } from "@/lib/address-changes";
import { ReviewClient } from "./review-client";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Address Changes" };

export default async function AddressChangesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canReviewAddressChanges(activeRole as Role)) redirect("/dashboard");

  const rawRequests = await getPendingAddressChangeRequests(activeCampaignId);
  // Cast to the ReviewClient's interface — Prisma returns a superset of the needed fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests = rawRequests as any;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Address Changes</h1>
        <p className="text-slate-500 mt-1">
          Review and approve or reject address change requests submitted by your team.
        </p>
      </div>

      <ReviewClient requests={requests} />
    </div>
  );
}
