import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCanvassingQueue } from "@/lib/canvassing";
import { CanvassScreen } from "./canvass-screen";

interface PageProps {
  params: Promise<{ listId: string }>;
}

export const metadata: Metadata = { title: "Canvassing" };

// Prevent caching — responses should always be fresh
export const dynamic = "force-dynamic";

export default async function CanvassPage({ params }: PageProps) {
  const { listId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  // Only canvassers and above can access this screen
  if (!activeRole) redirect("/dashboard");

  const queue = await getCanvassingQueue(listId, session.user.id, activeCampaignId);

  // No assignment found for this user+list
  if (!queue) notFound();

  // We need the list name — it's in the assignment context. Fetch it separately.
  // (getCanvassingQueue only returns entries; we can derive it from the canvass list)
  // Re-use the db import via a quick query here would add coupling;
  // instead, we grab the name from a light query via canvassing lib.
  // For simplicity, pass a light list name fetch from the existing detail loader.
  const { db } = await import("@/lib/db");
  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { name: true },
  });
  if (!list) notFound();

  return (
    <CanvassScreen
      listId={listId}
      listName={list.name}
      assignmentId={queue.assignmentId}
      entries={queue.entries}
    />
  );
}
