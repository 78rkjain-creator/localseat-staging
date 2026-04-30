import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSurveyDetail } from "@/lib/surveys";
import { SurveyBuilder } from "./survey-builder";

export const metadata: Metadata = { title: "Edit Survey" };

interface PageProps {
  params: Promise<{ surveyId: string }>;
}

export default async function SurveyEditPage({ params }: PageProps) {
  const { surveyId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") redirect("/dashboard");

  const survey = await getSurveyDetail(surveyId, activeCampaignId);
  if (!survey) notFound();

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      <Link
        href="/campaign-settings/surveys"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Surveys
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Edit survey</h1>
        <p className="text-slate-500 text-sm mt-1">
          Build the questions canvassers will see at the door.
        </p>
      </div>

      <SurveyBuilder
        surveyId={survey.id}
        initialName={survey.name}
        initialDescription={survey.description}
        initialIsActive={survey.isActive}
        initialQuestions={survey.questions.map((q) => ({
          id: q.id,
          label: q.label,
          questionType: q.questionType,
          options: Array.isArray(q.options) ? (q.options as string[]) : null,
          sortOrder: q.sortOrder,
          required: q.required,
        }))}
      />
    </div>
  );
}
