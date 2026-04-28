import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCanvassingQueue } from "@/lib/canvassing";
import { db } from "@/lib/db";
import { getActiveFieldMessages } from "@/lib/field-messages";
import { getActiveSurveyForCanvass } from "@/lib/surveys";
import { CanvassScreen } from "./canvass-screen";

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

  const [queue, campaign, fieldMessages, activeSurvey] = await Promise.all([
    getCanvassingQueue(listId, session.user.id, activeCampaignId),
    db.campaign.findUnique({ where: { id: activeCampaignId }, select: { city: true, canvassScript: true } }),
    getActiveFieldMessages(activeCampaignId),
    getActiveSurveyForCanvass(activeCampaignId),
  ]);
  if (!queue) notFound();

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
      activeSurvey={activeSurvey}
    />
  );
}
