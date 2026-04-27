"use client";

import { useState, useTransition } from "react";
import { checkInAttendee, addAttendee, removeAttendee } from "../actions";
import type { EventAttendeeStatus } from "@prisma/client";

interface Attendee {
  id: string;
  status: EventAttendeeStatus;
  checkedInAt: Date | null;
  notes: string | null;
  user: { id: string; firstName: string; lastName: string; email: string };
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Props {
  eventId: string;
  attendees: Attendee[];
  members: Member[];
  canManage: boolean;
}

export function AttendeePanel({ eventId, attendees, members, canManage }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const attendeeUserIds = new Set(attendees.map((a) => a.user.id));
  const eligibleMembers = members.filter((m) => !attendeeUserIds.has(m.id));

  function handleCheckIn(attendeeId: string) {
    startTransition(async () => {
      const result = await checkInAttendee(attendeeId, eventId);
      if (result.error) setError(result.error);
    });
  }

  function handleAdd() {
    if (!selectedUserId) return;
    startTransition(async () => {
      const result = await addAttendee(eventId, selectedUserId);
      if (result.error) setError(result.error);
      else setSelectedUserId("");
    });
  }

  function handleRemove(attendeeId: string) {
    startTransition(async () => {
      const result = await removeAttendee(attendeeId, eventId);
      if (result.error) setError(result.error);
    });
  }

  const attended = attendees.filter((a) => a.status === "attended");
  const confirmed = attendees.filter((a) => a.status !== "attended");

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Add attendee */}
      {canManage && eligibleMembers.length > 0 && (
        <div className="flex gap-2 mb-6">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Add a team member…</option>
            {eligibleMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName} {m.lastName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedUserId || isPending}
            className="h-10 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {attendees.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No attendees yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Attended */}
          {attended.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Attended ({attended.length})
              </p>
              {attended.map((a) => (
                <AttendeeRow
                  key={a.id}
                  attendee={a}
                  canManage={canManage}
                  isPending={isPending}
                  onCheckIn={handleCheckIn}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}

          {/* Confirmed / invited */}
          {confirmed.length > 0 && (
            <div>
              {attended.length > 0 && (
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-4">
                  Confirmed ({confirmed.length})
                </p>
              )}
              {confirmed.map((a) => (
                <AttendeeRow
                  key={a.id}
                  attendee={a}
                  canManage={canManage}
                  isPending={isPending}
                  onCheckIn={handleCheckIn}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AttendeeRow({
  attendee,
  canManage,
  isPending,
  onCheckIn,
  onRemove,
}: {
  attendee: { id: string; status: EventAttendeeStatus; checkedInAt: Date | null; user: { firstName: string; lastName: string } };
  canManage: boolean;
  isPending: boolean;
  onCheckIn: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const isAttended = attendee.status === "attended";

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-100 mb-1.5">
      <div className={[
        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold",
        isAttended ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500",
      ].join(" ")}>
        {attendee.user.firstName[0]}{attendee.user.lastName[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">
          {attendee.user.firstName} {attendee.user.lastName}
        </p>
        {isAttended && attendee.checkedInAt && (
          <p className="text-xs text-slate-400">
            Checked in {new Date(attendee.checkedInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </div>
      {canManage && (
        <div className="flex items-center gap-1.5">
          {!isAttended && (
            <button
              type="button"
              onClick={() => onCheckIn(attendee.id)}
              disabled={isPending}
              className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              Check in
            </button>
          )}
          {isAttended && (
            <span className="h-8 px-3 flex items-center text-xs font-semibold text-emerald-600">
              ✓ Attended
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(attendee.id)}
            disabled={isPending}
            className="h-8 w-8 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-colors disabled:opacity-50"
            aria-label="Remove attendee"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
