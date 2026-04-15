"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  updateVolunteerShift,
  assignVolunteerToShift,
  removeVolunteerFromShift,
  markAttendance,
} from "./actions";
import type { VolunteerAttendanceStatus } from "@/types";
import { VOLUNTEER_ATTENDANCE_LABELS } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type ShiftAttendee = {
  id: string;
  status: string;
  record: {
    id: string;
    status: string;
    person: { id: string; firstName: string; lastName: string };
  };
};

export type ShiftWithAttendees = {
  id: string;
  name: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  location: string | null;
  notes: string | null;
  maxVolunteers: number | null;
  attendees: ShiftAttendee[];
};

export type VolunteerRecordItem = {
  id: string;
  status: string;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    phoneHome: string | null;
    email: string | null;
    household: {
      address: {
        streetNumber: string;
        streetName: string;
        unitNumber: string | null;
        city: string;
      };
    } | null;
  };
};

// ── ShiftCard ─────────────────────────────────────────────────────────────────

export function ShiftCard({
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
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const assignedRecordIds = new Set(shift.attendees.map((a) => a.record.id));
  const unassignedRecords = volunteerRecords.filter((r) => !assignedRecordIds.has(r.id));

  const shiftDate = new Date(shift.date);
  const dateStr = shiftDate.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const dateInput = shiftDate.toISOString().split("T")[0];

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateVolunteerShift({
        shiftId: shift.id,
        name: fd.get("name") as string,
        date: fd.get("date") as string,
        startTime: fd.get("startTime") as string,
        endTime: fd.get("endTime") as string,
        location: fd.get("location") as string,
        notes: fd.get("notes") as string,
        maxVolunteers: fd.get("maxVolunteers") as string,
      });
      if (result.error) {
        setEditError(result.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function handleAssign(recordId: string) {
    if (!recordId) return;
    startTransition(async () => {
      await assignVolunteerToShift(shift.id, recordId);
      router.refresh();
    });
  }

  function handleRemove(recordId: string) {
    startTransition(async () => {
      await removeVolunteerFromShift(shift.id, recordId);
      router.refresh();
    });
  }

  function handleMarkAttendance(recordId: string, status: VolunteerAttendanceStatus) {
    startTransition(async () => {
      await markAttendance(shift.id, recordId, status);
      router.refresh();
    });
  }

  // ── Edit form ─────────────────────────────────────────────────────────────

  if (editing) {
    return (
      <Card padding="md">
        <h3 className="font-semibold text-slate-900 mb-4">Edit shift</h3>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
          <EditField label="Shift name" required>
            <input name="name" defaultValue={shift.name} required className={inputCls} />
          </EditField>

          <div className="grid grid-cols-2 gap-3">
            <EditField label="Date" required>
              <input name="date" type="date" defaultValue={dateInput} required className={inputCls} />
            </EditField>
            <EditField label="Max volunteers">
              <input
                name="maxVolunteers"
                type="number"
                min={1}
                defaultValue={shift.maxVolunteers ?? ""}
                className={inputCls}
              />
            </EditField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <EditField label="Start time" required>
              <input name="startTime" type="time" defaultValue={shift.startTime} required className={inputCls} />
            </EditField>
            <EditField label="End time" required>
              <input name="endTime" type="time" defaultValue={shift.endTime} required className={inputCls} />
            </EditField>
          </div>

          <EditField label="Location">
            <input name="location" defaultValue={shift.location ?? ""} className={inputCls} />
          </EditField>

          <EditField label="Notes">
            <textarea
              name="notes"
              defaultValue={shift.notes ?? ""}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </EditField>

          {editError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {editError}
            </p>
          )}

          <div className="flex gap-2 mt-1">
            <button
              type="submit"
              disabled={pending}
              className="h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setEditError(null); }}
              disabled={pending}
              className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    );
  }

  // ── Read view ─────────────────────────────────────────────────────────────

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
        <div className="flex items-start gap-2 flex-shrink-0">
          {isPast && shift.attendees.length > 0 && (
            <AttendanceSummary attendees={shift.attendees} />
          )}
          {!readOnly && !isPast && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-7 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Notes */}
      {shift.notes && (
        <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2 mb-4">
          {shift.notes}
        </p>
      )}

      {/* Attendees */}
      {shift.attendees.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Assigned volunteers
          </p>
          <div className="flex flex-col gap-2">
            {shift.attendees.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-700">
                  {a.record.person.firstName} {a.record.person.lastName}
                </span>
                <div className="flex items-center gap-2">
                  {isPast && !readOnly ? (
                    <AttendanceSelect
                      currentStatus={a.status as VolunteerAttendanceStatus}
                      onSave={(status) => handleMarkAttendance(a.record.id, status)}
                      pending={pending}
                    />
                  ) : (
                    <AttendancePill status={a.status as VolunteerAttendanceStatus} />
                  )}
                  {!readOnly && !isPast && (
                    <button
                      type="button"
                      onClick={() => handleRemove(a.record.id)}
                      disabled={pending}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                      aria-label="Remove volunteer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign volunteer */}
      {!readOnly && !isPast && unassignedRecords.length > 0 && (
        <AssignVolunteerRow
          records={unassignedRecords}
          onAssign={handleAssign}
          pending={pending}
        />
      )}
    </Card>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function AttendanceSelect({
  currentStatus,
  onSave,
  pending,
}: {
  currentStatus: VolunteerAttendanceStatus;
  onSave: (status: VolunteerAttendanceStatus) => void;
  pending: boolean;
}) {
  const [status, setStatus] = useState<VolunteerAttendanceStatus>(currentStatus);
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as VolunteerAttendanceStatus)}
        className="h-8 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="pending">Pending</option>
        <option value="attended">Attended</option>
        <option value="no_show">No show</option>
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => onSave(status)}
        className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}

function AssignVolunteerRow({
  records,
  onAssign,
  pending,
}: {
  records: VolunteerRecordItem[];
  onAssign: (recordId: string) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState("");
  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="flex-1 h-9 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="">Add volunteer…</option>
        {records.map((r) => (
          <option key={r.id} value={r.id}>
            {r.person.firstName} {r.person.lastName}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected || pending}
        onClick={() => { onAssign(selected); setSelected(""); }}
        className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}

function EditField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full";
