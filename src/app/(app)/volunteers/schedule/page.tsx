import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewVolunteers, isReadOnly } from "@/lib/permissions";
import { getVolunteerShifts, getVolunteerRecords } from "@/lib/volunteers";
import { Card } from "@/components/ui/card";
import { NewShiftButton } from "./shift-modal";
import {
  assignVolunteerToShift,
  removeVolunteerFromShift,
  markAttendance,
  markVolunteerCommitted,
} from "./actions";
import type { Role, VolunteerAttendanceStatus } from "@/types";
import { VOLUNTEER_ATTENDANCE_LABELS } from "@/types";

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
                      <a href={`/people/${r.person.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                        {r.person.firstName} {r.person.lastName}
                      </a>
                      {r.person.household?.address && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {r.person.household.address.streetNumber} {r.person.household.address.streetName}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      {r.person.phone ?? r.person.email ?? "—"}
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

// ── Shift card ─────────────────────────────────────────────────────────────────

type ShiftWithAttendees = Awaited<ReturnType<typeof getVolunteerShifts>>["upcoming"][number];
type VolunteerRecordItem = Awaited<ReturnType<typeof getVolunteerRecords>>[number];

function ShiftCard({
  shift,
  volunteerRecords,
  readOnly,
  isPast,
}: {
  shift: ShiftWithAttendees;
  volunteerRecords: VolunteerRecordItem[];
  readOnly: boolean;
  isPast: boolean;
}) {
  const assignedRecordIds = new Set(shift.attendees.map((a) => a.record.id));
  const unassignedRecords = volunteerRecords.filter((r) => !assignedRecordIds.has(r.id));

  const shiftDate = new Date(shift.date);
  const dateStr = shiftDate.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });

  return (
    <Card padding="md">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">{shift.name}</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {dateStr} · {shift.startTime}–{shift.endTime}
            {shift.location && ` · ${shift.location}`}
          </p>
          {shift.maxVolunteers && (
            <p className="text-xs text-slate-400 mt-0.5">
              {shift.attendees.length}/{shift.maxVolunteers} volunteers
            </p>
          )}
        </div>
        {isPast && shift.attendees.length > 0 && (
          <AttendanceSummary attendees={shift.attendees} />
        )}
      </div>

      {/* Notes */}
      {shift.notes && (
        <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2 mb-4">{shift.notes}</p>
      )}

      {/* Attendees */}
      {shift.attendees.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Assigned volunteers</p>
          <div className="flex flex-col gap-2">
            {shift.attendees.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-700">
                  {a.record.person.firstName} {a.record.person.lastName}
                </span>
                <div className="flex items-center gap-2">
                  {isPast && !readOnly ? (
                    <form action={async (fd: FormData) => {
                      "use server";
                      const status = fd.get("status") as VolunteerAttendanceStatus;
                      await markAttendance(shift.id, a.record.id, status);
                    }} className="flex items-center gap-1.5">
                      <select
                        name="status"
                        defaultValue={a.status}
                        className="h-8 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="attended">Attended</option>
                        <option value="no_show">No show</option>
                      </select>
                      <button type="submit" className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                        Save
                      </button>
                    </form>
                  ) : (
                    <AttendancePill status={a.status as VolunteerAttendanceStatus} />
                  )}
                  {!readOnly && !isPast && (
                    <form action={async () => {
                      "use server";
                      await removeVolunteerFromShift(shift.id, a.record.id);
                    }}>
                      <button type="submit" className="text-xs text-red-400 hover:text-red-600" aria-label="Remove">
                        ×
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign volunteer */}
      {!readOnly && !isPast && unassignedRecords.length > 0 && (
        <form action={async (fd: FormData) => {
          "use server";
          const recordId = fd.get("recordId") as string;
          if (recordId) await assignVolunteerToShift(shift.id, recordId);
        }} className="flex items-center gap-2">
          <select
            name="recordId"
            className="flex-1 h-9 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Add volunteer…</option>
            {unassignedRecords.map((r) => (
              <option key={r.id} value={r.id}>
                {r.person.firstName} {r.person.lastName}
              </option>
            ))}
          </select>
          <button type="submit" className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium hover:bg-slate-50 transition-colors">
            Add
          </button>
        </form>
      )}
    </Card>
  );
}

function AttendanceSummary({ attendees }: { attendees: { status: string }[] }) {
  const attended = attendees.filter((a) => a.status === "attended").length;
  const noShow = attendees.filter((a) => a.status === "no_show").length;
  const total = attendees.length;
  return (
    <div className="text-right flex-shrink-0">
      <p className="text-lg font-bold text-slate-900">{attended}/{total}</p>
      <p className="text-xs text-slate-400">attended</p>
      {noShow > 0 && <p className="text-xs text-red-400">{noShow} no-show</p>}
    </div>
  );
}

function AttendancePill({ status }: { status: VolunteerAttendanceStatus }) {
  const styles: Record<VolunteerAttendanceStatus, string> = {
    pending:  "bg-slate-100 text-slate-500",
    attended: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    no_show:  "bg-red-50 text-red-600 border border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {VOLUNTEER_ATTENDANCE_LABELS[status]}
    </span>
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
