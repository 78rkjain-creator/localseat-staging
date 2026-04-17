import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewVolunteers, isReadOnly } from "@/lib/permissions";
import { getVolunteerShifts, getVolunteerRecords } from "@/lib/volunteers";
import { Card } from "@/components/ui/card";
import { NewShiftButton } from "./shift-modal";
import { markVolunteerCommitted } from "./actions";
import { ShiftCard } from "./shift-card";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Volunteer Schedule" };

export default async function VolunteerSchedulePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewVolunteers(activeRole as Role)) redirect("/dashboard");

  const readOnly = isReadOnly(activeRole as Role);

  const [{ upcoming, past }, volunteerRecords] = await Promise.all([
    getVolunteerShifts(activeCampaignId),
    getVolunteerRecords(activeCampaignId),
  ]);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Volunteer Schedule</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {volunteerRecords.length} volunteer{volunteerRecords.length !== 1 ? "s" : ""} on file
          </p>
        </div>
        {!readOnly && <NewShiftButton />}
      </div>

      {/* Upcoming shifts */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Upcoming shifts ({upcoming.length})
        </h2>

        {upcoming.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-slate-400 text-center py-4">
              No upcoming shifts scheduled.{!readOnly && " Create one to start organizing your volunteers."}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {upcoming.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                volunteerRecords={volunteerRecords}
                readOnly={readOnly}
                isPast={false}
              />
            ))}
          </div>
        )}
      </section>

      {/* Volunteers on file */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Volunteers ({volunteerRecords.length})
        </h2>

        {volunteerRecords.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-slate-400 text-center py-4">
              No volunteers recorded yet. Volunteers are added when canvassers flag volunteer interest at the door.
            </p>
          </Card>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Contact</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  {!readOnly && <th className="w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {volunteerRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <a href={`/voter-list/${r.person.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                        {r.person.firstName} {r.person.lastName}
                      </a>
                      {r.person.household?.address && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {r.person.household.address.streetNumber} {r.person.household.address.streetName}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      {r.person.phoneHome ?? r.person.email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status as "interested" | "committed"} />
                    </td>
                    {!readOnly && r.status === "interested" && (
                      <td className="px-4 py-3 text-right">
                        <form action={async () => {
                          "use server";
                          await markVolunteerCommitted(r.id);
                        }}>
                          <button type="submit" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                            Mark committed
                          </button>
                        </form>
                      </td>
                    )}
                    {!readOnly && r.status === "committed" && <td />}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Past shifts */}
      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Past shifts ({past.length})
          </h2>
          <div className="flex flex-col gap-4">
            {past.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                volunteerRecords={volunteerRecords}
                readOnly={readOnly}
                isPast={true}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "interested" | "committed" }) {
  const styles = {
    interested: "bg-amber-50 text-amber-700 border-amber-200",
    committed:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {status === "interested" ? "Interested" : "Committed"}
    </span>
  );
}
