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

export const dynamic = "force-dynamic";

export default async function CanvassPage({ params }: PageProps) {
  const { listId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole) redirect("/dashboard");

  const queue = await getCanvassingQueue(listId, session.user.id, activeCampaignId);
  if (!queue) notFound();

  return (
    <CanvassScreen
      listId={listId}
      listName={queue.listName}
      assignmentId={queue.assignmentId}
      entries={queue.entries}
    />
  );
}
