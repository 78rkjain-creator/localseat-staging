import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { db } from "@/lib/db";
import { BackLink } from "@/components/ui/back-link";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Survey Results" };

type AnswerValue = string | string[] | number | null | undefined;
type AnswersJson = Record<string, AnswerValue>;

function fmt(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    single_choice: "Single choice",
    multi_choice: "Multi choice",
    text: "Text",
    rating: "Rating",
    yes_no: "Yes / No",
  };
  return labels[type] ?? type;
}

function pct(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

// ── Choice question rendering ────────────────────────────────────────────────

function ChoiceCard({
  questionAnswers,
  questionType,
  options,
  totalResponses,
}: {
  questionAnswers: AnswerValue[];
  questionType: "single_choice" | "multi_choice";
  options: string[] | null;
  totalResponses: number;
}) {
  const predefined = options ?? [];
  const countMap = new Map<string, number>();
  for (const opt of predefined) countMap.set(opt, 0);

  let answeredCount = 0;
  for (const ans of questionAnswers) {
    if (questionType === "single_choice") {
      if (typeof ans === "string" && ans.trim()) {
        countMap.set(ans, (countMap.get(ans) ?? 0) + 1);
        answeredCount++;
      }
    } else {
      if (Array.isArray(ans) && ans.length > 0) {
        answeredCount++;
        for (const a of ans) {
          if (typeof a === "string" && a.trim()) {
            countMap.set(a, (countMap.get(a) ?? 0) + 1);
          }
        }
      }
    }
  }

  const sorted = [...countMap.entries()].sort((a, b) => b[1] - a[1]);
  const maxCount = sorted[0]?.[1] ?? 0;
  const denominator = totalResponses;

  return (
    <div>
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400">No responses recorded.</p>
      ) : (
        <div className="space-y-2.5">
          {sorted.map(([label, count]) => (
            <div key={label} className="flex items-center gap-4">
              <span className="w-40 text-sm text-slate-700 truncate flex-shrink-0">{label}</span>
              <div className="flex-1 h-6 rounded bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded bg-brand-400"
                  style={{ width: maxCount > 0 ? `${Math.round((count / maxCount) * 100)}%` : "0%" }}
                />
              </div>
              <div className="text-right tabular-nums text-sm flex-shrink-0 w-20">
                <span className="font-semibold text-slate-900">{count.toLocaleString()}</span>
                <span className="text-slate-400 ml-1.5 text-xs">{pct(count, denominator)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {questionType === "multi_choice" && answeredCount > 0 && (
        <p className="text-xs text-slate-400 mt-2">Respondents could select multiple options</p>
      )}
    </div>
  );
}

// ── Yes/No question rendering ────────────────────────────────────────────────

function YesNoCard({
  questionAnswers,
  totalResponses,
}: {
  questionAnswers: AnswerValue[];
  totalResponses: number;
}) {
  let yesCount = 0;
  let noCount = 0;
  for (const ans of questionAnswers) {
    if (ans === "yes") yesCount++;
    else if (ans === "no") noCount++;
  }

  const maxCount = Math.max(yesCount, noCount);

  return (
    <div className="space-y-2.5">
      {[
        { label: "Yes", count: yesCount, bar: "bg-emerald-400" },
        { label: "No", count: noCount, bar: "bg-red-300" },
      ].map(({ label, count, bar }) => (
        <div key={label} className="flex items-center gap-4">
          <span className="w-40 text-sm text-slate-700 flex-shrink-0">{label}</span>
          <div className="flex-1 h-6 rounded bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded ${bar}`}
              style={{ width: maxCount > 0 ? `${Math.round((count / maxCount) * 100)}%` : "0%" }}
            />
          </div>
          <div className="text-right tabular-nums text-sm flex-shrink-0 w-20">
            <span className="font-semibold text-slate-900">{count.toLocaleString()}</span>
            <span className="text-slate-400 ml-1.5 text-xs">{pct(count, totalResponses)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Rating question rendering ────────────────────────────────────────────────

function RatingCard({ questionAnswers }: { questionAnswers: AnswerValue[] }) {
  const dist = [0, 0, 0, 0, 0]; // index 0 = rating 1
  let sum = 0;
  let count = 0;

  for (const ans of questionAnswers) {
    const n = typeof ans === "number" ? ans : typeof ans === "string" ? parseFloat(ans) : NaN;
    if (!isNaN(n) && n >= 1 && n <= 5) {
      dist[Math.round(n) - 1]++;
      sum += n;
      count++;
    }
  }

  const avg = count > 0 ? (sum / count).toFixed(1) : null;
  const maxDist = Math.max(...dist, 1);

  return (
    <div>
      {avg !== null ? (
        <div className="mb-5">
          <span className="text-3xl font-bold text-slate-900 tabular-nums">{avg}</span>
          <span className="text-lg text-slate-400 ml-1">/5</span>
        </div>
      ) : (
        <p className="text-sm text-slate-400 mb-4">No ratings recorded.</p>
      )}
      <div className="flex items-end gap-3">
        {dist.map((c, i) => {
          const barHeight = Math.max(4, Math.round((c / maxDist) * 80));
          return (
            <div key={i} className="inline-flex flex-col items-center gap-1 w-12">
              <span className="text-xs text-slate-700 font-semibold tabular-nums">{c > 0 ? c : ""}</span>
              <div
                className="w-4 rounded-t bg-brand-400"
                style={{ height: `${barHeight}px` }}
              />
              <span className="text-xs font-semibold text-slate-500">{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Text question rendering ──────────────────────────────────────────────────

function TextCard({ questionAnswers }: { questionAnswers: AnswerValue[] }) {
  const texts = questionAnswers
    .filter((ans): ans is string => typeof ans === "string" && ans.trim().length > 0)
    .map((ans) => ans.trim());

  const LIMIT = 15;
  const shown = texts.slice(0, LIMIT);
  const overflow = texts.length - LIMIT;

  if (texts.length === 0) {
    return <p className="text-sm text-slate-400">No text responses recorded</p>;
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">
        {texts.length.toLocaleString()} text {texts.length === 1 ? "response" : "responses"}
      </p>
      <div>
        {shown.map((text, i) => (
          <div key={i} className="py-2 border-b border-slate-50 last:border-0">
            <p className="text-sm text-slate-700 line-clamp-2">{text}</p>
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <p className="text-xs text-slate-400 mt-2">and {overflow.toLocaleString()} more responses</p>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function SurveyDetailResultsPage({
  params,
}: {
  params: { surveyId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewReports(activeRole as Role)) redirect("/dashboard");

  const campaignId = activeCampaignId;

  const survey = await db.survey.findFirst({
    where: { id: params.surveyId, campaignId, deletedAt: null },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!survey) notFound();

  const responses = await db.surveyResponse.findMany({
    where: { surveyId: survey.id },
    select: { answers: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const totalResponses = responses.length;
  const lastResponseDate = responses[0]?.createdAt ?? null;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-2">
        <BackLink fallbackHref="/reports/surveys" label="Survey results" />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{survey.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {totalResponses.toLocaleString()}{" "}
          {totalResponses === 1 ? "response" : "responses"}
          {" · "}
          {survey.questions.length}{" "}
          {survey.questions.length === 1 ? "question" : "questions"}
          {" · "}
          {lastResponseDate ? `Last response: ${fmt(lastResponseDate)}` : "No responses yet"}
        </p>
      </div>

      {survey.questions.length === 0 ? (
        <p className="text-sm text-slate-400">This survey has no questions.</p>
      ) : (
        survey.questions.map((question) => {
          const questionAnswers = responses.map((r) => {
            const ans = r.answers as AnswersJson;
            return ans[question.id] ?? null;
          });

          return (
            <div
              key={question.id}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-4"
            >
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{question.label}</p>
                <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {typeLabel(question.questionType)}
                </span>
              </div>

              <div className="px-5 py-4">
                {(question.questionType === "single_choice" ||
                  question.questionType === "multi_choice") && (
                  <ChoiceCard
                    questionAnswers={questionAnswers}
                    questionType={question.questionType}
                    options={question.options as string[] | null}
                    totalResponses={totalResponses}
                  />
                )}
                {question.questionType === "yes_no" && (
                  <YesNoCard
                    questionAnswers={questionAnswers}
                    totalResponses={totalResponses}
                  />
                )}
                {question.questionType === "rating" && (
                  <RatingCard questionAnswers={questionAnswers} />
                )}
                {question.questionType === "text" && (
                  <TextCard questionAnswers={questionAnswers} />
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
