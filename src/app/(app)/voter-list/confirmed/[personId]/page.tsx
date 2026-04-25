import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople } from "@/lib/permissions";
import { getPersonDetail } from "@/lib/people";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { SupportLevelBadge, OutcomeBadge } from "@/components/ui/badge";
import type { Role, SupportLevel, CanvassOutcome } from "@/types";

interface PageProps {
  params: Promise<{ personId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  await params;
  return { title: "Voter" };
}

export default async function ConfirmedVoterDetailPage({ params }: PageProps) {
  const { personId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole && !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  const [person, voterMemberships] = await Promise.all([
    getPersonDetail(personId, activeCampaignId),
    db.personListMembership.findMany({
      where: {
        personId,
        campaignId: activeCampaignId,
        listImport: { type: "official_voters_list" },
        status: { in: ["matched", "created", "accepted"] },
      },
      select: {
        id: true,
        status: true,
        listImport: { select: { name: true, importedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!person || !person.isConfirmedVoter) notFound();

  const address = person.household?.address;
  const latestCanvass = person.canvassResponses[0];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/voter-list/confirmed"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Voter List
      </Link>

      {/* Person header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold text-slate-500">
            {person.firstName[0]}{person.lastName[0]}
          </span>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">
              {person.firstName} {person.lastName}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Confirmed voter
            </span>
          </div>
          {address && (
            <p className="text-slate-500 text-sm mt-0.5">
              {address.streetNumber} {address.streetName}
              {address.unitNumber ? ` #${address.unitNumber}` : ""},{" "}
              {address.city}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Contact info */}
        <Card padding="md">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Contact
          </h2>
          <dl className="flex flex-col gap-2">
            {person.phoneHome && (
              <div className="flex gap-3">
                <dt className="text-xs text-slate-400 w-24 flex-shrink-0 pt-0.5">Home</dt>
                <dd className="text-sm text-slate-800">{person.phoneHome}</dd>
              </div>
            )}
            {person.phoneMobile && (
              <div className="flex gap-3">
                <dt className="text-xs text-slate-400 w-24 flex-shrink-0 pt-0.5">Mobile</dt>
                <dd className="text-sm text-slate-800">{person.phoneMobile}</dd>
              </div>
            )}
            {person.email && (
              <div className="flex gap-3">
                <dt className="text-xs text-slate-400 w-24 flex-shrink-0 pt-0.5">Email</dt>
                <dd className="text-sm text-slate-800">{person.email}</dd>
              </div>
            )}
            {!person.phoneHome && !person.phoneMobile && !person.email && (
              <p className="text-sm text-slate-400">No contact info on file.</p>
            )}
          </dl>
        </Card>

        {/* Support level */}
        {latestCanvass && (
          <Card padding="md">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Canvass status
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <OutcomeBadge outcome={latestCanvass.outcome as CanvassOutcome} />
              {latestCanvass.supportLevel && (
                <SupportLevelBadge level={latestCanvass.supportLevel as SupportLevel} />
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {new Date(latestCanvass.respondedAt).toLocaleDateString("en-CA", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </Card>
        )}

        {/* Notes (read-only) */}
        {person.notes.length > 0 && (
          <Card padding="md">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Notes
            </h2>
            <ul className="flex flex-col gap-3">
              {person.notes.map((note) => (
                <li key={note.id} className="flex flex-col gap-1">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {note.body}
                  </p>
                  <p className="text-xs text-slate-400">
                    {note.author.firstName} {note.author.lastName} &middot;{" "}
                    {new Date(note.createdAt).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Voter list source */}
        <Card padding="md">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Voter List Source
          </h2>
          {voterMemberships.length === 0 ? (
            <p className="text-sm text-slate-400">No import records on file.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100">
              {voterMemberships.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                  <span className="text-sm text-slate-800">{m.listImport.name}</span>
                  <span className="text-xs text-slate-400 flex-shrink-0 ml-4">
                    {new Date(m.listImport.importedAt).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Link to full record */}
        <p className="text-xs text-slate-400 text-center">
          <Link
            href={`/voter-list/${person.id}`}
            className="hover:text-slate-600 underline underline-offset-2"
          >
            View full record
          </Link>
        </p>
      </div>
    </div>
  );
}
