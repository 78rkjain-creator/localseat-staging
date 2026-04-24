import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canReviewAddressChanges } from "@/lib/permissions";
import {
  getPendingAddressChangeRequests,
  getPendingAddressChangeCount,
} from "@/lib/address-changes";
import {
  getPendingVoterChangeRequests,
  getPendingVoterChangeCount,
} from "@/lib/voter-change-requests";
import { VoterChangeReviewClient } from "./voter-change-review-client";
import { AddressReviewClient } from "./address-review-client";
import Link from "next/link";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Data Corrections" };

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function DataCorrectionsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canReviewAddressChanges(activeRole as Role)) redirect("/dashboard");

  const { tab } = await searchParams;
  const activeTab = tab === "address-changes" ? "address-changes" : "record-changes";

  const [voterChangeCount, addressChangeCount] = await Promise.all([
    getPendingVoterChangeCount(activeCampaignId),
    getPendingAddressChangeCount(activeCampaignId),
  ]);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Data Corrections</h1>
        <p className="text-slate-500 mt-1">
          Review and apply record corrections and address changes submitted by your team.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
        <TabLink
          href="/data-corrections?tab=record-changes"
          active={activeTab === "record-changes"}
          label="Record changes"
          count={voterChangeCount}
        />
        <TabLink
          href="/data-corrections?tab=address-changes"
          active={activeTab === "address-changes"}
          label="Address changes"
          count={addressChangeCount}
        />
      </div>

      {activeTab === "record-changes" ? (
        <RecordChangesTab campaignId={activeCampaignId} />
      ) : (
        <AddressChangesTab campaignId={activeCampaignId} />
      )}
    </div>
  );
}

async function RecordChangesTab({ campaignId }: { campaignId: string }) {
  const rawRequests = await getPendingVoterChangeRequests(campaignId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <VoterChangeReviewClient requests={rawRequests as any} />;
}

async function AddressChangesTab({ campaignId }: { campaignId: string }) {
  const rawRequests = await getPendingAddressChangeRequests(campaignId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <AddressReviewClient requests={rawRequests as any} />;
}

function TabLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700",
      ].join(" ")}
    >
      {label}
      {count > 0 && (
        <span
          className={[
            "inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[11px] font-semibold",
            active
              ? "bg-brand-500 text-white"
              : "bg-slate-300 text-slate-600",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
