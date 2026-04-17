"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { logOutreach, searchPeople } from "./actions";
import type { OutreachChannel } from "@/types";
import { OUTREACH_CHANNEL_LABELS } from "@/types";

const CHANNELS = Object.entries(OUTREACH_CHANNEL_LABELS) as [OutreachChannel, string][];

interface PersonResult {
  id: string;
  firstName: string;
  lastName: string;
  address: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LogEntryModal({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonResult[]>([]);
  const [selected, setSelected] = useState<PersonResult | null>(null);
  const [isSearching, startSearch] = useTransition();

  const [channel, setChannel] = useState<OutreachChannel>("phone_call");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");

  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSearch(value: string) {
    setQuery(value);
    if (selected) setSelected(null);
    if (value.trim().length < 2) { setResults([]); return; }
    startSearch(async () => {
      const found = await searchPeople(value);
      setResults(found);
    });
  }

  function handleSelect(person: PersonResult) {
    setSelected(person);
    setQuery(`${person.firstName} ${person.lastName}`);
    setResults([]);
  }

  function handleSave() {
    if (!selected) { setError("Select a person first."); return; }
    setError(null);
    startSave(async () => {
      const result = await logOutreach({
        personId: selected.id,
        channel,
        date,
        outcome: outcome || undefined,
        notes: notes || undefined,
      });
      if (result.error) { setError(result.error); return; }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setQuery(""); setSelected(null); setResults([]);
        setChannel("phone_call");
        setDate(new Date().toISOString().split("T")[0]);
        setOutcome(""); setNotes("");
        onClose();
      }, 800);
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Log outreach">
      <div className="flex flex-col gap-4">
        {/* Person search */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Person</label>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name…"
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            {results.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <p className="text-sm font-medium text-slate-800">{p.firstName} {p.lastName}</p>
                    {p.address && <p className="text-xs text-slate-500">{p.address}</p>}
                  </button>
                ))}
              </div>
            )}
            {isSearching && (
              <p className="absolute top-full mt-1 text-xs text-slate-400">Searching…</p>
            )}
          </div>
          {selected && (
            <p className="text-xs text-emerald-600 font-medium">✓ {selected.firstName} {selected.lastName}</p>
          )}
        </div>

        {/* Channel + Date in a row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as OutreachChannel)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {CHANNELS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Outcome */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Outcome <span className="text-slate-400 font-normal">(optional)</span></label>
          <input
            type="text"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="e.g. Left voicemail, Spoke briefly"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context…"
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            disabled={!selected || isSaving}
            className="flex-1"
          >
            {success ? "Saved!" : "Save entry"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
