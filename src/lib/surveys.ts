import { db } from "@/lib/db";
import type { SurveyQuestionType } from "@prisma/client";

export type { SurveyQuestionType };

export interface SurveyQuestionItem {
  id: string;
  label: string;
  questionType: SurveyQuestionType;
  options: string[] | null;
  sortOrder: number;
  required: boolean;
}

export interface ActiveSurvey {
  id: string;
  name: string;
  questions: SurveyQuestionItem[];
}

export interface SurveyListItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  _count: { questions: number; responses: number };
}

export async function getActiveSurveyForCanvass(campaignId: string): Promise<ActiveSurvey | null> {
  const survey = await db.survey.findFirst({
    where: { campaignId, isActive: true, deletedAt: null },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!survey) return null;
  return {
    id: survey.id,
    name: survey.name,
    questions: survey.questions.map((q) => ({
      id: q.id,
      label: q.label,
      questionType: q.questionType,
      options: Array.isArray(q.options) ? (q.options as string[]) : null,
      sortOrder: q.sortOrder,
      required: q.required,
    })),
  };
}

export async function getSurveyList(campaignId: string) {
  return db.survey.findMany({
    where: { campaignId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      _count: { select: { questions: true, responses: true } },
    },
  });
}

export async function getSurveyDetail(surveyId: string, campaignId: string) {
  return db.survey.findFirst({
    where: { id: surveyId, campaignId, deletedAt: null },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
    },
  });
}
