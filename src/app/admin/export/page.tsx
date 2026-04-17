import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSuperUser } from "@/lib/permissions";
import { ExportClient } from "./export-client";

export default async function AdminExportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) redirect("/admin");
  if (!isSuperUser(session.user.platformRole)) redirect("/admin");

  const [campaigns, tags, users] = await Promise.all([
    db.campaign.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.tag.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Platform Export</h1>
        <p className="mt-1 text-sm text-slate-500">
          Export raw platform data as CSV. Super user access only.
        </p>
      </div>

      <ExportClient campaigns={campaigns} tags={tags} users={users} />
    </div>
  );
}
