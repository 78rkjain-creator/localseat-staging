"use client";

import { useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCampaign } from "./actions";

export default function CreateCampaignPage() {
  const { update } = useSession();
  const [name, setName] = useState("");
  const [ballotName, setBallotName] = useState("");
  const [officeSought, setOfficeSought] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [wardsInput, setWardsInput] = useState("");
  const [electionDate, setElectionDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await createCampaign({ name, ballotName, officeSought, municipality, wardsInput, electionDate });
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // Refresh the JWT token with the new campaign membership
      await update({ refreshMemberships: true, activeCampaignId: result?.campaignId });
      // Hard navigate — ensures the browser sends the updated cookie before the next page loads
      window.location.href = `/onboarding/choose-plan?campaignId=${result?.campaignId}`;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-soft">
          <svg
            className="h-7 w-7 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            LocalSeat
          </h1>
        </div>
      </div>

      {/* Onboarding card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-card border border-slate-100 p-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-1">
          Let&apos;s set up your campaign
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          A few quick details to get you started. You can update these later.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Campaign name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith for City Council"
            autoFocus
            required
          />

          <div className="flex flex-col gap-1.5">
            <Input
              label="Your name on the ballot"
              type="text"
              value={ballotName}
              onChange={(e) => setBallotName(e.target.value)}
              placeholder="Jane Smith"
            />
            <p className="text-xs text-slate-400">As it will appear on official materials</p>
          </div>

          <Input
            label="Office sought"
            type="text"
            value={officeSought}
            onChange={(e) => setOfficeSought(e.target.value)}
            placeholder="e.g. City Councillor, Mayor, School Board Trustee"
          />

          <Input
            label="Municipality"
            type="text"
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
            placeholder="Ottawa"
          />

          <div className="flex flex-col gap-1.5">
            <Input
              label="Ward(s) or district(s)"
              type="text"
              value={wardsInput}
              onChange={(e) => setWardsInput(e.target.value)}
              placeholder="Ward 3, Ward 7"
            />
            <p className="text-xs text-slate-400">Enter one or more, separated by commas (e.g. Ward 3, Ward 7)</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="electionDate" className="text-sm font-medium text-slate-700">
              Election date (optional)
            </label>
            <input
              id="electionDate"
              type="date"
              value={electionDate}
              onChange={(e) => setElectionDate(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 hover:border-slate-300 bg-white px-4 text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={loading}
            className="mt-1"
          >
            Create campaign
          </Button>
        </form>
      </div>

      <p className="mt-8 text-xs text-slate-400">
        LocalSeat &mdash; Built for Canadian municipal campaigns
      </p>
    </div>
  );
}
