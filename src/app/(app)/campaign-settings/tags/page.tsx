import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTags } from "@/lib/permissions";
import { TagsClient } from "./tags-client";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Custom Tags" };

const TAG_CAP = 100;

export default async function TagsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canManageTags(activeRole as Role)) redirect("/dashboard");

  const tags = await db.tag.findMany({
    where: { campaignId: activeCampaignId, deletedAt: null },
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { personTags: true } },
    },
    orderBy: { name: "asc" },
  });

  const initialTags = tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    personCount: t._count.personTags,
  }));

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Custom Tags</h1>
        <p className="text-slate-500 text-sm mt-1 max-w-xl">
          Create and manage the tags available across this campaign. Tags can be applied to
          any resident profile. Up to {TAG_CAP} tags per campaign.
        </p>
      </div>

      <TagsClient initialTags={initialTags} tagCap={TAG_CAP} />
    </div>
  );
}
