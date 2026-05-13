"use client";

import type { CanvassState } from "./use-canvass-state";
import { SurveyPanel } from "@/components/survey-panel";

interface TabSurveyProps {
  state: CanvassState;
}

export function TabSurvey({ state }: TabSurveyProps) {
  const { activeSurvey, surveyAnswers, setSurveyAnswers, current } = state;

  if (!activeSurvey) return null;

  const personName = current
    ? `${current.person.firstName} ${current.person.lastName}`
    : "";

  // Check if survey has required questions
  const hasRequired = activeSurvey.questions.some((q) => q.required);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-2.5 z-10 flex items-center gap-2">
        <p className="text-xs text-slate-500 truncate flex-1">
          <span className="font-semibold text-slate-700">Survey for:</span> {personName}
        </p>
        {hasRequired && (
          <span className="flex-shrink-0 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 uppercase tracking-wide">
            Required
          </span>
        )}
      </div>

      {/* Survey content */}
      <div className="px-4 py-4 max-w-lg mx-auto">
        <SurveyPanel
          survey={activeSurvey}
          answers={surveyAnswers}
          onChange={setSurveyAnswers}
        />
      </div>
    </div>
  );
}
