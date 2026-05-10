"use client";

import { useState, useTransition } from "react";
import { checkInAttendee, addAttendee, removeAttendee, addGuestAttendee } from "../actions";
import type { EventAttendeeStatus } from "@prisma/client";

interface Attendee {
  id: string;
  status: EventAttendeeStatus;
  checkedInAt: Date | null;
  notes: string | null;
  guestName: string | null;
  guestEmail: string | null;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
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

function getDisplayName(a: Attendee): string {
  if (a.user) return `${a.user.firstName} ${a.user.lastName}`;
  return a.guestName ?? "Guest";
}

function getInitials(a: Attendee): string {
  if (a.user) return `${a.user.firstName[0]}${a.user.lastName[0]}`;
  if (a.guestName) {
    const parts = a.guestName.trim().split(/\s+/);
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : a.guestName.slice(0, 2);
  }
  return "G";
}

export function AttendeePanel({ eventId, attendees, members, canManage }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const attendeeUserIds = new Set(attendees.filter((a) => a.user).map((a) => a.user!.id));
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

  function handleAddGuest() {
    if (!guestName.trim()) return;
    startTransition(async () => {
      const result = await addGuestAttendee(eventId, guestName.trim(), guestEmail.trim() || null);
      if (result.error) setError(result.error);
      else {
        setGuestName("");
        setGuestEmail("");
        setShowGuestForm(false);
      }
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
  const guestCount = attendees.filter((a) => !a.user).length;
  const teamCount = attendees.filter((a) => !!a.user).length;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Add attendee */}
      {canManage && (
        <div className="mb-6">
          {eligibleMembers.length > 0 && (
            <div className="flex gap-2 mb-2">
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

          {!showGuestForm ? (
            <button
              type="button"
              onClick={() => setShowGuestForm(true)}
              className="text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors"
            >
              + Add a guest (not on the team)
            </button>
          ) : (
            <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Add guest
              </p>
              <div className="flex flex-col gap-2 mb-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Full name"
                  className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddGuest}
                  disabled={!guestName.trim() || isPending}
                  className="h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  Add guest
                </button>
                <button
                  type="button"
                  onClick={() => { setShowGuestForm(false); setGuestName(""); setGuestEmail(""); }}
                  className="h-9 px-4 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {attendees.length > 0 && guestCount > 0 && (
        <p className="text-xs text-slate-400 mb-3">
          {teamCount} team · {guestCount} guest{guestCount !== 1 ? "s" : ""}
        </p>
      )}

      {attendees.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No attendees yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
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
  attendee: Attendee;
  canManage: boolean;
  isPending: boolean;
  onCheckIn: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const isAttended = attendee.status === "attended";
  const displayName = getDisplayName(attendee);
  const initials = getInitials(attendee);
  const isGuest = !attendee.user;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-100 mb-1.5">
      <div className={[
        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold",
        isAttended ? "bg-emerald-100 text-emerald-700" : isGuest ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-500",
      ].join(" ")}>
        {initials.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">
          {displayName}
          {isGuest && (
            <span className="text-[10px] text-violet-500 font-normal ml-1">Guest</span>
          )}
        </p>
        {isAttended && attendee.checkedInAt && (
          <p className="text-xs text-slate-400">
            Checked in {new Date(attendee.checkedInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
        {isGuest && attendee.guestEmail && (
          <p className="text-xs text-slate-400">{attendee.guestEmail}</p>
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
