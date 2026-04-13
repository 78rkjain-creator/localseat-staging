import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageWalkLists, hasMinimumRole } from "@/lib/permissions";
import { getCanvassLists } from "@/lib/canvassing";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NewListButton } from "./new-list-button";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Canvassing" };

export default async function CanvassingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  // Canvassers are handled in Step 9; redirect them for now
  if (activeRole === "canvasser") redirect("/dashboard");

  // Roles that may not view this page at all
  if (activeRole && !hasMinimumRole(activeRole as Role, "field_organizer")) {
    redirect("/dashboard");
  }

  const lists = await getCanvassLists(activeCampaignId);
  const canManage = activeRole ? canManageWalkLists(activeRole as Role) : false;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Canvassing</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {lists.length} walk list{lists.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManage && <NewListButton />}
      </div>

      {lists.length === 0 ? (
        <EmptyState
          title="No walk lists yet"
          description="Create a walk list to start assigning canvassers and tracking door knocks."
          action={canManage ? <NewListButton /> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {lists.map((list) => {
            const assigneeNames = list.assignments
              .map((a) => `${a.canvasser.firstName} ${a.canvasser.lastName}`)
              .slice(0, 3)
              .join(", ");
            const extraAssignees =
              list.assignments.length > 3
                ? ` +${list.assignments.length - 3} more`
                : "";

            return (
              <Link key={list.id} href={`/canvassing/${list.id}`}>
                <Card
                  padding="md"
                  className="hover:border-brand-200 hover:shadow-soft transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="h-10 w-10 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        className="h-5 w-5 text-brand-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.75}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{list.name}</p>
                      {list.description && (
                        <p className="text-sm text-slate-500 mt-0.5 truncate">
                          {list.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                        {list.assignments.length > 0 ? (
                          <span className="text-xs text-slate-500">
                            {assigneeNames}
                            {extraAssignees}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            No canvassers assigned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-2xl font-bold text-slate-900">
                        {list.totalResponses}
                      </p>
                      <p className="text-xs text-slate-400">doors</p>
                    </div>

                    {/* Chevron */}
                    <svg
                      className="h-4 w-4 text-slate-300 flex-shrink-0 self-center"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
