import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Survey Results" };

function fmt(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function SurveyResultsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewReports(activeRole as Role)) redirect("/dashboard");

  const campaignId = activeCampaignId;

  const surveys = await db.survey.findMany({
    where: { campaignId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      questions: { select: { id: true } },
      _count: { select: { responses: true } },
    },
  });

  const lastResponseDates = await Promise.all(
    surveys.map((s) =>
      db.surveyResponse.findFirst({
        where: { surveyId: s.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
    )
  );

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Survey results</h1>
        <p className="text-slate-500 text-sm mt-0.5">View response data from canvassing surveys</p>
      </div>

      {surveys.length === 0 ? (
        <EmptyState
          title="No surveys"
          description="Create a survey in Admin → Surveys to start collecting structured data during canvassing."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {surveys.map((survey, i) => {
            const responseCount = survey._count.responses;
            const lastDate = lastResponseDates[i];
            return (
              <Link
                key={survey.id}
                href={`/reports/surveys/${survey.id}`}
                className="bg-white rounded-2xl border border-slate-100 px-5 py-4 hover:bg-slate-50 transition-colors block"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-base font-semibold text-slate-900">{survey.name}</p>
                  <span
                    className={[
                      "flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                      survey.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500",
                    ].join(" ")}
                  >
                    {survey.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-sm text-slate-500">
                    {survey.questions.length}{" "}
                    {survey.questions.length === 1 ? "question" : "questions"}
                  </span>
                  <span className="text-sm text-slate-700 font-semibold">
                    {responseCount.toLocaleString()}{" "}
                    {responseCount === 1 ? "response" : "responses"}
                  </span>
                  {lastDate ? (
                    <span className="text-xs text-slate-400">
                      Last response: {fmt(lastDate.createdAt)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">No responses yet</span>
                  )}
                  <span className="text-xs text-slate-400">
                    Created: {fmt(survey.createdAt)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
