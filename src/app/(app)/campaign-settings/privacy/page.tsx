import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateDataRetention } from "./actions";

const LEGACY_PURPOSE_LABELS: Record<string, string> = {
  lawn_sign_consent: "Lawn sign consent",
  volunteer_consent: "Volunteer consent",
  petition: "Petition",
  other: "Other",
};

export const metadata: Metadata = { title: "Privacy & Data" };

const RETENTION_OPTIONS: { label: string; value: number | null }[] = [
  { label: "6 months", value: 6 },
  { label: "1 year", value: 12 },
  { label: "2 years", value: 24 },
  { label: "No limit", value: null },
];

function pct(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

export default async function PrivacyPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole !== "candidate" && activeRole !== "campaign_manager") redirect("/dashboard");

  const [
    totalCount,
    withPhoneCount,
    withEmailCount,
    canvassedCount,
    anonymizedCount,
    campaign,
    recentSignatures,
  ] = await Promise.all([
    db.person.count({ where: { campaignId: activeCampaignId, deletedAt: null } }),
    db.person.count({
      where: {
        campaignId: activeCampaignId,
        deletedAt: null,
        OR: [{ phoneHome: { not: null } }, { phoneMobile: { not: null } }],
      },
    }),
    db.person.count({ where: { campaignId: activeCampaignId, deletedAt: null, email: { not: null } } }),
    db.person.count({
      where: { campaignId: activeCampaignId, deletedAt: null, canvassResponses: { some: {} } },
    }),
    db.person.count({
      where: {
        campaignId: activeCampaignId,
        deletedAt: null,
        anonymizedAt: { not: null },
      },
    }),
    db.campaign.findUnique({
      where: { id: activeCampaignId },
      select: { dataRetentionMonths: true },
    }),
    db.signatureRecord.findMany({
      where: { campaignId: activeCampaignId },
      select: {
        id: true,
        purpose: true,
        collectedAt: true,
        person: {
          select: { id: true, firstName: true, lastName: true, anonymizedAt: true },
        },
        collectedBy: { select: { firstName: true, lastName: true } },
        consentItems: { select: { consentType: { select: { label: true } } } },
      },
      orderBy: { collectedAt: "desc" },
      take: 25,
    }),
  ]);

  const currentRetention = campaign?.dataRetentionMonths ?? null;
  const currentRetentionLabel =
    RETENTION_OPTIONS.find((o) => o.value === currentRetention)?.label ?? "No limit";

  const stats = [
    { label: "Total records", value: totalCount, sub: null },
    { label: "With phone", value: withPhoneCount, sub: pct(withPhoneCount, totalCount) },
    { label: "With email", value: withEmailCount, sub: pct(withEmailCount, totalCount) },
    { label: "Canvassed", value: canvassedCount, sub: pct(canvassedCount, totalCount) },
    { label: "Anonymized", value: anonymizedCount, sub: pct(anonymizedCount, totalCount) },
  ];

  async function saveRetention(formData: FormData) {
    "use server";
    const raw = formData.get("months");
    const months = raw === "null" || raw === null ? null : Number(raw);
    await updateDataRetention(months);
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <Link
        href="/campaign-settings/ward"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Settings
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Privacy &amp; Data</h1>
        <p className="text-slate-500 text-sm mt-1">
          Overview of personal data your campaign holds and tools to manage it responsibly.
        </p>
      </div>

      {/* ── Data inventory ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Data inventory
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-2xl font-bold text-slate-900">{s.value.toLocaleString()}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{s.label}</p>
              {s.sub !== null && (
                <p className="text-xs text-slate-400 mt-0.5">{s.sub} of total</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Data retention ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Data retention
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-5">
          <p className="text-sm text-slate-600 mb-1 leading-relaxed">
            How long should personal data be kept after the campaign ends?
          </p>
          <p className="text-xs text-slate-400 mb-4">
            This is a policy reminder — data is not automatically deleted. Your team is responsible for manual review.
          </p>
          <form action={saveRetention} className="flex items-center gap-3 flex-wrap">
            <select
              name="months"
              defaultValue={currentRetention === null ? "null" : String(currentRetention)}
              className="h-10 px-3 pr-8 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
            >
              {RETENTION_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-10 px-5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Save
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-3">
            Current policy:{" "}
            <span className="text-slate-600 font-medium">{currentRetentionLabel}</span>
          </p>
        </div>
      </section>

      {/* ── Consent log ── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Consent log
        </h2>
        <p className="text-xs text-slate-400 mb-3">
          Most recent {recentSignatures.length > 0 ? Math.min(recentSignatures.length, 25) : 0} signature consent records collected by your campaign.
        </p>
        {recentSignatures.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-10 text-center">
            <p className="text-sm text-slate-400">No consent signatures collected yet.</p>
            <p className="text-xs text-slate-300 mt-1">
              Signatures collected on person pages will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Person
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Purpose
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Collected by
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSignatures.map((sig) => {
                  const isAnon = sig.person.anonymizedAt !== null;
                  return (
                    <tr key={sig.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        {isAnon ? (
                          <span className="text-xs text-slate-400 italic">Anonymized record</span>
                        ) : (
                          <Link
                            href={`/people/${sig.person.id}`}
                            className="text-brand-600 hover:underline font-medium"
                          >
                            {sig.person.firstName} {sig.person.lastName}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {sig.consentItems.length > 0
                          ? sig.consentItems.map((c) => c.consentType.label).join(", ")
                          : (LEGACY_PURPOSE_LABELS[sig.purpose] ?? sig.purpose)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                        {sig.collectedBy.firstName} {sig.collectedBy.lastName}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell whitespace-nowrap">
                        {new Date(sig.collectedAt).toLocaleDateString("en-CA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
