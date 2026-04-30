import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ConsentTypesClient } from "./consent-types-client";

export const metadata: Metadata = { title: "Signature Consent Types" };

const CONSENT_TYPE_CAP = 6;

export default async function SignatureConsentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole !== "candidate" && activeRole !== "campaign_manager") redirect("/dashboard");

  const types = await db.signatureConsentType.findMany({
    where: { campaignId: activeCampaignId, deletedAt: null },
    select: {
      id: true,
      label: true,
      sortOrder: true,
      _count: { select: { consents: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  const initialTypes = types.map((t) => ({
    id: t.id,
    label: t.label,
    sortOrder: t.sortOrder,
    usageCount: t._count.consents,
  }));

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Signature Consent Types</h1>
        <p className="text-slate-500 text-sm mt-1 max-w-xl">
          Customize the consent categories available when collecting signatures. Up to {CONSENT_TYPE_CAP} types per campaign.
        </p>
      </div>

      <ConsentTypesClient initialTypes={initialTypes} cap={CONSENT_TYPE_CAP} />
    </div>
  );
}
