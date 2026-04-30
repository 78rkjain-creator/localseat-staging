"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { SurveyQuestionType } from "@prisma/client";

const ALLOWED_ROLES = ["candidate", "campaign_manager", "data_manager"] as const;

async function getSession() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!ALLOWED_ROLES.includes(activeRole as typeof ALLOWED_ROLES[number])) redirect("/dashboard");
  return { session, activeCampaignId };
}

export async function createSurvey(formData: FormData) {
  const { session, activeCampaignId } = await getSession();
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return;
  const survey = await db.survey.create({
    data: {
      campaignId: activeCampaignId,
      name,
      createdById: session.user.id,
    },
    select: { id: true },
  });
  redirect(`/campaign-settings/surveys/${survey.id}`);
}

export async function updateSurveyMeta(
  surveyId: string,
  data: { name: string; description: string; isActive: boolean }
) {
  const { activeCampaignId } = await getSession();
  await db.survey.updateMany({
    where: { id: surveyId, campaignId: activeCampaignId },
    data: { name: data.name, description: data.description || null, isActive: data.isActive },
  });
  revalidatePath(`/campaign-settings/surveys/${surveyId}`);
  revalidatePath("/campaign-settings/surveys");
}

export interface QuestionInput {
  label: string;
  questionType: SurveyQuestionType;
  options: string[];
  required: boolean;
}

export async function saveSurveyQuestions(surveyId: string, questions: QuestionInput[]) {
  const { activeCampaignId } = await getSession();
  const survey = await db.survey.findFirst({
    where: { id: surveyId, campaignId: activeCampaignId },
    select: { id: true },
  });
  if (!survey) return;

  await db.$transaction(async (tx) => {
    await tx.surveyQuestion.deleteMany({ where: { surveyId } });
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const hasOptions = q.questionType === "single_choice" || q.questionType === "multi_choice";
      await tx.surveyQuestion.create({
        data: {
          surveyId,
          label: q.label,
          questionType: q.questionType,
          options: hasOptions && q.options.length > 0 ? q.options : Prisma.JsonNull,
          sortOrder: i,
          required: q.required,
        },
      });
    }
  });

  revalidatePath(`/campaign-settings/surveys/${surveyId}`);
}

export async function deleteSurvey(surveyId: string) {
  const { activeCampaignId } = await getSession();
  await db.survey.updateMany({
    where: { id: surveyId, campaignId: activeCampaignId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/campaign-settings/surveys");
  redirect("/campaign-settings/surveys");
}
