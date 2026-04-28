"use client";

import { useState } from "react";
import type { ActiveSurvey } from "@/lib/surveys";

interface Props {
  survey: ActiveSurvey;
  answers: Record<string, unknown>;
  onChange: (answers: Record<string, unknown>) => void;
}

export function SurveyPanel({ survey, answers, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function set(questionId: string, value: unknown) {
    onChange({ ...answers, [questionId]: value });
  }

  function toggleMulti(questionId: string, option: string) {
    const current = (answers[questionId] as string[] | undefined) ?? [];
    const next = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    set(questionId, next);
  }

  const answeredCount = survey.questions.filter((q) => {
    const a = answers[q.id];
    if (a === undefined || a === null || a === "") return false;
    if (Array.isArray(a)) return a.length > 0;
    return true;
  }).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 mt-1.5 overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-sm font-semibold text-slate-800">{survey.name}</span>
          {answeredCount > 0 && (
            <span className="text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2 h-4 flex items-center">
              {answeredCount}/{survey.questions.length}
            </span>
          )}
        </div>
        <svg
          className={["h-4 w-4 text-slate-400 transition-transform", open ? "rotate-180" : ""].join(" ")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Questions */}
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {survey.questions.map((q) => {
            const val = answers[q.id];
            return (
              <div key={q.id} className="px-4 py-3">
                <p className="text-xs font-semibold text-slate-700 mb-2 leading-snug">
                  {q.label}
                  {q.required && <span className="text-red-400 ml-1">*</span>}
                </p>

                {q.questionType === "text" && (
                  <input
                    type="text"
                    value={(val as string | undefined) ?? ""}
                    onChange={(e) => set(q.id, e.target.value)}
                    placeholder="Answer…"
                    className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                )}

                {q.questionType === "yes_no" && (
                  <div className="flex gap-2">
                    {(["yes", "no"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => set(q.id, val === opt ? null : opt)}
                        className={[
                          "flex-1 h-9 rounded-xl border-2 text-sm font-medium transition-all",
                          val === opt
                            ? opt === "yes"
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-red-400 bg-red-400 text-white"
                            : "border-slate-200 bg-white text-slate-600",
                        ].join(" ")}
                      >
                        {opt === "yes" ? "Yes" : "No"}
                      </button>
                    ))}
                  </div>
                )}

                {q.questionType === "rating" && (
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => set(q.id, val === n ? null : n)}
                        className={[
                          "flex-1 h-9 rounded-xl border-2 text-sm font-bold transition-all",
                          val === n
                            ? "border-amber-500 bg-amber-400 text-white"
                            : "border-slate-200 bg-white text-slate-500",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}

                {q.questionType === "single_choice" && q.options && (
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => set(q.id, val === opt ? null : opt)}
                        className={[
                          "w-full h-9 px-3 text-left rounded-lg border text-sm transition-all",
                          val === opt
                            ? "border-brand-500 bg-brand-50 text-brand-800 font-medium"
                            : "border-slate-200 bg-white text-slate-600",
                        ].join(" ")}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {q.questionType === "multi_choice" && q.options && (
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((opt) => {
                      const selected = ((val as string[] | undefined) ?? []).includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleMulti(q.id, opt)}
                          className={[
                            "w-full h-9 px-3 text-left rounded-lg border text-sm transition-all flex items-center gap-2",
                            selected
                              ? "border-brand-500 bg-brand-50 text-brand-800 font-medium"
                              : "border-slate-200 bg-white text-slate-600",
                          ].join(" ")}
                        >
                          <span className={[
                            "h-4 w-4 rounded border-2 flex-shrink-0 flex items-center justify-center",
                            selected ? "border-brand-500 bg-brand-500" : "border-slate-300",
                          ].join(" ")}>
                            {selected && (
                              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
