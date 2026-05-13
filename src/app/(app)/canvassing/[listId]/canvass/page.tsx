import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCanvassingQueue, getAssignedLists } from "@/lib/canvassing";
import { db } from "@/lib/db";
import { isGotvMode } from "@/lib/gotv";
import { getActiveFieldMessages } from "@/lib/field-messages";
import { getActiveSurveyForCanvass } from "@/lib/surveys";
import { CanvassScreen } from "./canvass-tabs";
import { GotvCanvassScreen } from "./gotv-canvass-screen";

interface PageProps {
  params: Promise<{ listId: string }>;
}

export const metadata: Metadata = { title: "Canvassing" };

export const dynamic = "force-dynamic";

export default async function CanvassPage({ params }: PageProps) {
  const { listId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole) redirect("/dashboard");

  const [queue, campaign, fieldMessages, activeSurvey, consentTypes, gotvEnabled, listSurveyRecord, assignedLists] = await Promise.all([
    getCanvassingQueue(listId, session.user.id, activeCampaignId),
    db.campaign.findUnique({ where: { id: activeCampaignId }, select: { city: true, canvassScript: true } }),
    getActiveFieldMessages(activeCampaignId),
    getActiveSurveyForCanvass(activeCampaignId),
    db.signatureConsentType.findMany({
      where: { campaignId: activeCampaignId, deletedAt: null },
      select: { id: true, label: true },
      orderBy: { sortOrder: "asc" },
    }),
    isGotvMode(activeCampaignId),
    // Check for per-list survey override
    db.canvassList.findFirst({
      where: { id: listId, campaignId: activeCampaignId, surveyId: { not: null } },
      select: {
        survey: {
          include: { questions: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
    getAssignedLists(session.user.id, activeCampaignId),
  ]);
  if (!queue) notFound();

  // Use list-specific survey if assigned, otherwise fall back to campaign default
  const effectiveSurvey = listSurveyRecord?.survey
    ? {
        id: listSurveyRecord.survey.id,
        name: listSurveyRecord.survey.name,
        questions: listSurveyRecord.survey.questions.map((q) => ({
          id: q.id,
          label: q.label,
          questionType: q.questionType,
          options: Array.isArray(q.options) ? (q.options as string[]) : null,
          sortOrder: q.sortOrder,
          required: q.required,
        })),
      }
    : activeSurvey;

  // Fetch upcoming appointments for people on this list
  const personIds = queue.entries.map((e) => e.person.id);
  const appointmentsByPersonId: Record<string, string> = {};

  if (personIds.length > 0) {
    const appointments = await db.task.findMany({
      where: {
        campaignId: activeCampaignId,
        type: "appointment",
        completed: false,
        deletedAt: null,
        personId: { in: personIds },
        dueDate: { gte: new Date() },
      },
      select: { personId: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    });

    for (const appt of appointments) {
      if (appt.personId && appt.dueDate && !appointmentsByPersonId[appt.personId]) {
        appointmentsByPersonId[appt.personId] = appt.dueDate.toISOString();
      }
    }
  }

  if (gotvEnabled) {
    return (
      <GotvCanvassScreen
        listId={listId}
        listName={queue.listName}
        assignmentId={queue.assignmentId}
        campaignId={activeCampaignId}
        entries={queue.entries}
      />
    );
  }

  return (
    <CanvassScreen
      listId={listId}
      listName={queue.listName}
      assignmentId={queue.assignmentId}
      campaignId={activeCampaignId}
      campaignCity={campaign?.city ?? ""}
      canvassScript={campaign?.canvassScript ?? null}
      entries={queue.entries}
      competitors={queue.competitors}
      appointmentsByPersonId={appointmentsByPersonId}
      fieldMessages={fieldMessages}
      activeSurvey={effectiveSurvey}
      consentTypes={consentTypes}
      demoMode={process.env.DEMO_MODE === "true"}
      assignedLists={assignedLists}
    />
  );
}
