"use client";

import { useState, useTransition } from "react";
import { assignTask, unassignTask } from "./actions";

interface AssignFormProps {
  taskId: string;
  currentAssigneeId?: string;
  teamMembers: { id: string; firstName: string; lastName: string; role: string }[];
}

export function AssignForm({ taskId, currentAssigneeId, teamMembers }: AssignFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const assigneeId = fd.get("assigneeId") as string;

    startTransition(async () => {
      let result: { error?: string };
      if (assigneeId === "__unassign__") {
        result = await unassignTask(taskId);
      } else if (assigneeId) {
        result = await assignTask(taskId, assigneeId);
      } else {
        return;
      }
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <select
          name="assigneeId"
          defaultValue={currentAssigneeId ?? ""}
          disabled={pending}
          className="h-9 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
        >
          <option value="">Assign to…</option>
          {currentAssigneeId && (
            <option value="__unassign__">— Unassign</option>
          )}
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.firstName} {m.lastName}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 font-medium hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
