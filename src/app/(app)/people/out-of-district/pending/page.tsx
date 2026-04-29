import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { QueueRow } from "./queue-row";
import type { QueueRowPerson } from "./queue-row";

export const metadata: Metadata = { title: "Pending Out-of-District Requests" };

export default async function PendingOutOfDistrictPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  if (activeRole !== "candidate" && activeRole !== "campaign_manager") {
    redirect("/people/out-of-district");
  }

  // New OOD fields are in the DB but not yet in the generated Prisma types.
  // Cast db.person to any here; remove after running `prisma generate`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const people: QueueRowPerson[] = await (db.person as any).findMany({
    where: {
      campaignId: activeCampaignId,
      deletedAt: null,
      outOfDistrictApprovalStatus: "pending",
      listSource: { not: "team" },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      outOfDistrictRequestedAt: true,
      outOfDistrictRequester: {
        select: { firstName: true, lastName: true },
      },
      household: {
        select: {
          address: {
            select: {
              streetNumber: true,
              streetName: true,
              unitNumber: true,
              city: true,
            },
          },
        },
      },
    },
    orderBy: { outOfDistrictRequestedAt: "asc" },
  });

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/people/out-of-district"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Out of District
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Pending Requests</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {people.length === 0
            ? "No pending requests."
            : `${people.length} ${people.length === 1 ? "request" : "requests"} awaiting review`}
        </p>
      </div>

      {people.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-12 text-center">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">All caught up</p>
          <p className="text-sm text-slate-400">No pending out-of-district requests.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {people.map((person) => (
              <QueueRow key={person.id} person={person} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
