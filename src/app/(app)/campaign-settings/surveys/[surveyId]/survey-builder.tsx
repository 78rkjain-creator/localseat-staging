"use client";

import { useState, useTransition } from "react";
import { updateSurveyMeta, saveSurveyQuestions } from "../actions";
import type { QuestionInput } from "../actions";
import type { SurveyQuestionType } from "@/lib/surveys";

interface ExistingQuestion {
  id: string;
  label: string;
  questionType: SurveyQuestionType;
  options: string[] | null;
  sortOrder: number;
  required: boolean;
}

interface Props {
  surveyId: string;
  initialName: string;
  initialDescription: string | null;
  initialIsActive: boolean;
  initialQuestions: ExistingQuestion[];
}

interface DraftQuestion {
  tempId: string;
  label: string;
  questionType: SurveyQuestionType;
  options: string[];
  required: boolean;
}

const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  text: "Text",
  single_choice: "Single choice",
  multi_choice: "Multiple choice",
  rating: "Rating (1–5)",
  yes_no: "Yes / No",
};

function uid() {
  return Math.random().toString(36).slice(2);
}

export function SurveyBuilder({ surveyId, initialName, initialDescription, initialIsActive, initialQuestions }: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [isActive, setIsActive] = useState(initialIsActive);
  const [questions, setQuestions] = useState<DraftQuestion[]>(() =>
    initialQuestions.map((q) => ({
      tempId: uid(),
      label: q.label,
      questionType: q.questionType,
      options: q.options ?? [],
      required: q.required,
    }))
  );
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      { tempId: uid(), label: "", questionType: "text", options: [], required: false },
    ]);
    setSaved(false);
  }

  function removeQuestion(tempId: string) {
    setQuestions((prev) => prev.filter((q) => q.tempId !== tempId));
    setSaved(false);
  }

  function moveUp(i: number) {
    if (i === 0) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
    setSaved(false);
  }

  function moveDown(i: number) {
    setQuestions((prev) => {
      if (i === prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
    setSaved(false);
  }

  function updateQuestion(tempId: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q) => q.tempId === tempId ? { ...q, ...patch } : q));
    setSaved(false);
  }

  function addOption(tempId: string) {
    setQuestions((prev) =>
      prev.map((q) => q.tempId === tempId ? { ...q, options: [...q.options, ""] } : q)
    );
    setSaved(false);
  }

  function updateOption(tempId: string, idx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.tempId !== tempId) return q;
        const opts = [...q.options];
        opts[idx] = value;
        return { ...q, options: opts };
      })
    );
    setSaved(false);
  }

  function removeOption(tempId: string, idx: number) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.tempId !== tempId) return q;
        return { ...q, options: q.options.filter((_, i) => i !== idx) };
      })
    );
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      const payload: QuestionInput[] = questions.map((q) => ({
        label: q.label,
        questionType: q.questionType,
        options: q.options.filter((o) => o.trim().length > 0),
        required: q.required,
      }));
      await updateSurveyMeta(surveyId, { name, description, isActive });
      await saveSurveyQuestions(surveyId, payload);
      setSaved(true);
    });
  }

  const hasChoiceOptions = (type: SurveyQuestionType) =>
    type === "single_choice" || type === "multi_choice";

  return (
    <div>
      {/* Survey meta */}
      <div className="bg-white rounded-2xl border border-slate-100 px-5 py-5 mb-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Survey name</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false); }}
              maxLength={120}
              className="h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Description <span className="font-normal normal-case">(optional)</span>
            </label>
            <input
              value={description}
              onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
              maxLength={300}
              placeholder="Brief description for your team…"
              className="h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => { setIsActive((v) => !v); setSaved(false); }}
              className={[
                "relative w-10 h-6 rounded-full transition-colors flex-shrink-0",
                isActive ? "bg-emerald-500" : "bg-slate-200",
              ].join(" ")}
            >
              <div className={[
                "absolute top-1 h-4 w-4 bg-white rounded-full shadow-sm transition-all",
                isActive ? "left-5" : "left-1",
              ].join(" ")} />
            </div>
            <span className="text-sm font-medium text-slate-700">
              {isActive ? "Active — shown on canvassing screen" : "Inactive — hidden from canvassers"}
            </span>
          </label>
        </div>
      </div>

      {/* Questions */}
      <div className="flex flex-col gap-3 mb-5">
        {questions.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center">
            <p className="text-sm text-slate-400">No questions yet. Add one below.</p>
          </div>
        )}

        {questions.map((q, i) => (
          <div key={q.tempId} className="bg-white rounded-2xl border border-slate-100 px-5 py-4">
            {/* Row 1: reorder + label */}
            <div className="flex items-start gap-2 mb-3">
              <div className="flex flex-col gap-0.5 flex-shrink-0 mt-1">
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="h-5 w-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === questions.length - 1}
                  className="h-5 w-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Q{i + 1}
                </p>
                <input
                  value={q.label}
                  onChange={(e) => updateQuestion(q.tempId, { label: e.target.value })}
                  placeholder="Question label…"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <button
                type="button"
                onClick={() => removeQuestion(q.tempId)}
                className="flex-shrink-0 mt-6 text-slate-300 hover:text-red-400 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Row 2: type + required */}
            <div className="flex items-center gap-3 mb-3">
              <select
                value={q.questionType}
                onChange={(e) => updateQuestion(q.tempId, { questionType: e.target.value as SurveyQuestionType, options: [] })}
                className="flex-1 h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none"
              >
                {(Object.entries(QUESTION_TYPE_LABELS) as [SurveyQuestionType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => updateQuestion(q.tempId, { required: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-xs text-slate-600 font-medium">Required</span>
              </label>
            </div>

            {/* Options for choice questions */}
            {hasChoiceOptions(q.questionType) && (
              <div className="flex flex-col gap-2 pl-7">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full border border-slate-300 flex-shrink-0" />
                    <input
                      value={opt}
                      onChange={(e) => updateOption(q.tempId, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                      className="flex-1 h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(q.tempId, oi)}
                      className="text-slate-300 hover:text-red-400 transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption(q.tempId)}
                  className="text-xs text-brand-500 hover:text-brand-700 font-medium text-left transition-colors"
                >
                  + Add option
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={addQuestion}
          className="flex-1 h-11 rounded-2xl border-2 border-dashed border-slate-200 text-sm text-slate-500 font-medium hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          + Add question
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="h-11 px-6 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-2xl transition-colors"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save survey"}
        </button>
      </div>
    </div>
  );
}
