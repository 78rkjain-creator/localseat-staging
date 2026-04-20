import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageWalkLists } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ListMapClient } from "../ListMapClient";
import type { Role, CanvassOutcome, SupportLevel } from "@/types";

interface PageProps {
  params: Promise<{ listId: string }>;
}

export default async function ListMapPage({ params }: PageProps) {
  const { listId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  const isManager = activeRole ? canManageWalkLists(activeRole as Role) : false;

  // Canvassers must have an active assignment to this list
  if (!isManager) {
    if (activeRole !== "canvasser") redirect("/canvassing");

    const assignment = await db.canvassAssignment.findFirst({
      where: {
        canvassListId: listId,
        canvasserId: session.user.id,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!assignment) redirect("/canvassing");
  }

  // Fetch list, entries, and responses in parallel
  const [list, entries, responses] = await Promise.all([
    db.canvassList.findFirst({
      where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
      select: { id: true, name: true },
    }),
    db.canvassListEntry.findMany({
      where: { canvassListId: listId, deletedAt: null },
      select: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            household: {
              select: {
                address: {
                  select: {
                    streetNumber: true,
                    streetName: true,
                    unitNumber: true,
                    lat: true,
                    lng: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.canvassResponse.findMany({
      where: {
        assignment: {
          canvassListId: listId,
          deletedAt: null,
        },
      },
      select: {
        personId: true,
        outcome: true,
        supportLevel: true,
      },
      orderBy: { respondedAt: "desc" },
    }),
  ]);

  if (!list) notFound();

  // Key latest response by personId (already ordered desc, so first wins)
  const responseByPerson = new Map<
    string,
    { outcome: string; supportLevel: string | null }
  >();
  for (const r of responses) {
    if (!responseByPerson.has(r.personId)) {
      responseByPerson.set(r.personId, {
        outcome: r.outcome,
        supportLevel: r.supportLevel,
      });
    }
  }

  // Build combined entry data
  const mapEntries = entries.map((e) => {
    const addr = e.person.household?.address ?? null;
    const response = responseByPerson.get(e.person.id) ?? null;

    const addressLine = addr
      ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
      : null;

    return {
      personId: e.person.id,
      name: `${e.person.firstName} ${e.person.lastName}`,
      address: addressLine,
      lat: addr?.lat ?? null,
      lng: addr?.lng ?? null,
      outcome: (response?.outcome ?? null) as CanvassOutcome | null,
      supportLevel: (response?.supportLevel ?? null) as SupportLevel | null,
    };
  });

  const geocodedCount = mapEntries.filter((e) => e.lat !== null).length;

  if (geocodedCount < 2) {
    return (
      <div className="px-4 sm:px-6 py-12 max-w-lg mx-auto text-center">
        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Map data is still being prepared</h2>
        <p className="text-sm text-slate-500 mb-6">
          Addresses need to be geocoded before they appear on the map. Check back shortly.
        </p>
        <Link
          href={`/canvassing/${listId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <ListMapClient
      entries={mapEntries}
      listId={listId}
      listName={list.name}
    />
  );
}
