import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { WardReviewClient } from "./ward-review-client";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Ward boundary review" };

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager", "co_chair"];

export type FlaggedPerson = {
  id: string;
  firstName: string;
  lastName: string;
  wardStatus: "outside" | "pending_review";
  address: string | null;
};

export default async function WardReviewPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    redirect("/dashboard");
  }

  const rawPeople = await db.person.findMany({
    where: {
      campaignId: activeCampaignId,
      deletedAt: null,
      wardStatus: { in: ["outside", "pending_review"] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      wardStatus: true,
      household: {
        select: {
          address: {
            select: {
              streetNumber: true,
              streetName: true,
              unitNumber: true,
              city: true,
              province: true,
            },
          },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const people: FlaggedPerson[] = rawPeople.map((p) => {
    const addr = p.household?.address;
    let addressStr: string | null = null;
    if (addr) {
      const unit = addr.unitNumber ? ` Unit ${addr.unitNumber}` : "";
      addressStr = `${addr.streetNumber} ${addr.streetName}${unit}, ${addr.city}, ${addr.province}`;
    }
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      wardStatus: p.wardStatus as "outside" | "pending_review",
      address: addressStr,
    };
  });

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ward boundary review</h1>
        <p className="text-slate-500 text-sm mt-1">
          These voters were flagged during import because their address falls outside your ward boundary.
          Save them anyway to keep them in your voter list, or discard to remove them.
        </p>
      </div>

      {people.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-900">No voters are waiting for review.</p>
          <p className="text-xs text-slate-400 mt-1">
            Flagged records will appear here after a CSV import.
          </p>
        </div>
      ) : (
        <WardReviewClient people={people} />
      )}
    </div>
  );
}
