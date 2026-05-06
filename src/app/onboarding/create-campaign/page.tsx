"use client";

import { useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCampaign } from "./actions";
import { Logo } from "@/components/brand/Logo";
import { MunicipalitySelector } from "@/components/ui/municipality-selector";
import type { MunicipalitySelectorValue } from "@/components/ui/municipality-selector";
import { MunicipalityMap } from "@/components/ui/municipality-map";
import type { Polygon, MultiPolygon } from "geojson";

async function fetchBoundaryById(id: string): Promise<Polygon | MultiPolygon | null> {
  try {
    const res = await fetch(`/data/boundaries/${id}.json`);
    if (!res.ok) return null;
    const raw = await res.json();
    // Support both raw geometry and GeoJSON Feature wrapper
    return (raw?.type === "Feature" ? raw.geometry : raw) as Polygon | MultiPolygon;
  } catch {
    return null;
  }
}

export default function CreateCampaignPage() {
  const { update } = useSession();
  const [name, setName] = useState("");
  const [ballotName, setBallotName] = useState("");
  const [officeSought, setOfficeSought] = useState("");
  const [selected, setSelected] = useState<MunicipalitySelectorValue | null>(null);
  const [boundary, setBoundary] = useState<Polygon | MultiPolygon | null>(null);
  const [loadingBoundary, setLoadingBoundary] = useState(false);
  const [wardsInput, setWardsInput] = useState("");
  const [electionDate, setElectionDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleMunicipalityChange(value: MunicipalitySelectorValue | null) {
    setSelected(value);
    setBoundary(null);
    if (value?.id) {
      setLoadingBoundary(true);
      const geo = await fetchBoundaryById(value.id);
      setBoundary(geo);
      setLoadingBoundary(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await createCampaign({
        name,
        ballotName,
        officeSought,
        wardsInput,
        electionDate,
        municipalityName: selected?.name,
        municipalityId: selected?.id ?? undefined,
        municipalityBoundary: boundary ? JSON.stringify(boundary) : undefined,
      });
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // Refresh the JWT token with the new campaign membership
      await update({ refreshMemberships: true, activeCampaignId: result?.campaignId });
      // Wait for the session cookie to propagate before navigating
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Skip municipality onboarding step if already selected
      if (selected?.name) {
        window.location.href = `/onboarding/choose-plan?campaignId=${result?.campaignId}`;
      } else {
        window.location.href = `/onboarding/select-municipality?campaignId=${result?.campaignId}&next=choose-plan`;
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <Logo size={48} tone="ink" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            LocalSeat
          </h1>
        </div>
      </div>

      {/* Onboarding card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
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

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Municipality
            </label>
            <MunicipalitySelector
              value={selected}
              onChange={handleMunicipalityChange}
              placeholder="Search Ontario municipalities…"
            />
            {selected && (
              <div className="mt-1">
                <MunicipalityMap
                  boundary={boundary}
                  municipalityName={selected.name}
                  center={selected.center}
                  loading={loadingBoundary}
                />
              </div>
            )}
          </div>

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
              className="h-12 w-full rounded-2xl border border-slate-200 hover:border-slate-300 bg-white px-4 text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
