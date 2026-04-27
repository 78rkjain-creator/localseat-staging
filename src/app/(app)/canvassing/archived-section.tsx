"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

interface ArchivedList {
  id: string;
  name: string;
  description: string | null;
  totalEntries: number;
  totalResponses: number;
  dynamicFilters: unknown;
}

interface Props {
  lists: ArchivedList[];
}

export function ArchivedSection({ lists }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (lists.length === 0) return null;

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 mb-3 group"
      >
        <h2 className="text-sm font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">
          Archived Lists
        </h2>
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
          {lists.length}
        </span>
        <svg
          className={[
            "h-4 w-4 text-slate-400 transition-transform",
            expanded ? "rotate-180" : "",
          ].join(" ")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3">
          {lists.map((list) => (
            <Link key={list.id} href={`/canvassing/${list.id}`}>
              <Card padding="md" className="hover:border-slate-200 hover:shadow-soft transition-all cursor-pointer opacity-70 hover:opacity-100">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-700">{list.name}</p>
                      {!!list.dynamicFilters && (
                        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700 border border-sky-200">
                          Dynamic
                        </span>
                      )}
                    </div>
                    {list.description && (
                      <p className="text-sm text-slate-400 mt-0.5 truncate">{list.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {list.totalEntries} {list.totalEntries === 1 ? "person" : "people"}
                      {" · "}
                      {list.totalResponses} doors
                    </p>
                  </div>

                  <svg className="h-4 w-4 text-slate-300 flex-shrink-0 self-center" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
