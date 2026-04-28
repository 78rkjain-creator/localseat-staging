import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveGeneralSettings } from "./actions";

export const metadata: Metadata = { title: "General Settings" };

export default async function GeneralSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole !== "candidate" && activeRole !== "campaign_manager") redirect("/dashboard");

  const campaign = await db.campaign.findUnique({
    where: { id: activeCampaignId },
    select: { name: true, electionDate: true, fundraisingGoal: true },
  });
  if (!campaign) redirect("/dashboard");

  const electionDateValue = campaign.electionDate
    ? campaign.electionDate.toISOString().split("T")[0]
    : "";

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
        <h1 className="text-2xl font-bold text-slate-900">General</h1>
        <p className="text-slate-500 text-sm mt-1">
          Core campaign details used across the platform.
        </p>
      </div>

      <form action={saveGeneralSettings}>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">

          {/* Campaign name */}
          <div className="px-5 py-5">
            <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Campaign name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={campaign.name}
              placeholder="e.g. Alex Chen for Ward 3"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Shown in the sidebar and on exports.
            </p>
          </div>

          {/* Election date */}
          <div className="px-5 py-5">
            <label htmlFor="electionDate" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Election date
            </label>
            <input
              id="electionDate"
              name="electionDate"
              type="date"
              defaultValue={electionDateValue}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Used on the dashboard to show days remaining.
            </p>
          </div>

          {/* Fundraising goal */}
          <div className="px-5 py-5">
            <label htmlFor="fundraisingGoal" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Fundraising goal
            </label>
            <div className="relative inline-flex items-center">
              <span className="absolute left-3 text-sm text-slate-400 pointer-events-none">$</span>
              <input
                id="fundraisingGoal"
                name="fundraisingGoal"
                type="number"
                min="0"
                step="1"
                defaultValue={campaign.fundraisingGoal ?? ""}
                placeholder="0"
                className="h-10 pl-7 pr-3 w-40 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Shown on the finance dashboard as a progress target.
            </p>
          </div>

        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="h-10 px-6 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
