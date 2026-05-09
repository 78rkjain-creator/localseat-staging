"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveVoterChangeRequest,
  approveNewResidentRequest,
  rejectVoterChangeRequest,
} from "@/lib/voter-change-requests";
import type { VoterChangeFields, NewResidentData } from "@/lib/voter-change-requests";

const FIELD_LABELS: Record<keyof VoterChangeFields, string> = {
  firstName: "First name",
  lastName: "Last name",
  phoneHome: "Home phone",
  phoneMobile: "Mobile phone",
  email: "Email",
  birthDate: "Birth date",
};

interface Request {
  id: string;
  createdAt: Date;
  requestType: string | null;
  proposedChanges: unknown;
  currentSnapshot: unknown;
  person: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  submittedBy: { firstName: string; lastName: string };
}

interface VoterChangeReviewClientProps {
  requests: Request[];
}

export function VoterChangeReviewClient({ requests }: VoterChangeReviewClientProps) {
  const router = useRouter();

  if (requests.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-700 mb-1">All caught up</p>
        <p className="text-sm text-slate-400">No pending record corrections.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {requests.map((req) => (
        <VoterChangeRow
          key={req.id}
          request={req}
          onReviewed={() => router.refresh()}
        />
      ))}
    </div>
  );
}

function VoterChangeRow({
  request,
  onReviewed,
}: {
  request: Request;
  onReviewed: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const isNewResident = request.requestType === "new_resident";

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = isNewResident
        ? await approveNewResidentRequest(request.id)
        : await approveVoterChangeRequest(request.id);
      if (result.error) {
        setError(result.error);
      } else {
        setDone("approved");
        onReviewed();
      }
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectVoterChangeRequest(request.id);
      if (result.error) {
        setError(result.error);
      } else {
        setDone("rejected");
        onReviewed();
      }
    });
  }

  if (done) {
    return (
      <div
        className={[
          "rounded-2xl border px-5 py-4 flex items-center gap-3",
          done === "approved"
            ? "bg-emerald-50 border-emerald-200"
            : "bg-slate-50 border-slate-200",
        ].join(" ")}
      >
        <svg
          className={["h-5 w-5 flex-shrink-0", done === "approved" ? "text-emerald-600" : "text-slate-400"].join(" ")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {done === "approved" ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          )}
        </svg>
        <p className="text-sm font-medium text-slate-700">
          {done === "approved"
            ? isNewResident ? "Approved — resident added to voter list" : "Approved — record updated"
            : "Rejected"}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4">
        {/* Header row — person name + type badge + submitter */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-slate-900">
                {isNewResident
                  ? formatResidentName(request.proposedChanges)
                  : `${request.person?.firstName ?? ""} ${request.person?.lastName ?? ""}`.trim()}
              </p>
              {isNewResident && (
                <span className="inline-flex items-center h-5 px-2 rounded-full bg-brand-100 text-brand-700 text-[10px] font-semibold uppercase tracking-wide">
                  New resident
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Submitted by {request.submittedBy.firstName} {request.submittedBy.lastName}
              {" · "}
              {new Date(request.createdAt).toLocaleDateString("en-CA", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Content — differs by type */}
        {isNewResident ? (
          <NewResidentDetails data={request.proposedChanges as NewResidentData} />
        ) : (
          <FieldDiff
            proposed={request.proposedChanges as VoterChangeFields}
            current={request.currentSnapshot as VoterChangeFields}
          />
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3 mt-3">
            {error}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-t border-slate-100">
        <button
          onClick={handleApprove}
          disabled={pending}
          className="h-8 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
        >
          {pending ? "…" : "Approve"}
        </button>
        <button
          onClick={handleReject}
          disabled={pending}
          className="h-8 px-4 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-white disabled:opacity-50 transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function FieldDiff({
  proposed,
  current,
}: {
  proposed: VoterChangeFields;
  current: VoterChangeFields;
}) {
  const changedFields = Object.keys(proposed) as (keyof VoterChangeFields)[];
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
      <div className="grid grid-cols-3 bg-slate-50 px-4 py-2 border-b border-slate-200">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Field</p>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Current</p>
        <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wide">Proposed</p>
      </div>
      {changedFields.map((field) => (
        <div key={field} className="grid grid-cols-3 px-4 py-2.5 border-b border-slate-100 last:border-b-0">
          <p className="text-xs font-medium text-slate-500">{FIELD_LABELS[field] ?? field}</p>
          <p className="text-xs text-slate-400 line-through">{formatFieldValue(current[field])}</p>
          <p className="text-xs text-brand-700 font-medium">{formatFieldValue(proposed[field])}</p>
        </div>
      ))}
    </div>
  );
}

function NewResidentDetails({ data }: { data: NewResidentData }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Submitted details</p>
      </div>
      <div className="px-4 py-3 flex flex-col gap-1.5">
        <DetailRow label="Name" value={`${data.firstName} ${data.lastName}`} />
        <DetailRow
          label="Address"
          value={[
            `${data.streetNumber} ${data.streetName}`,
            data.unitNumber ? `Unit ${data.unitNumber}` : null,
            data.city,
            data.postalCode,
          ].filter(Boolean).join(", ")}
        />
        {data.phone && <DetailRow label="Phone" value={data.phone} />}
        {data.email && <DetailRow label="Email" value={data.email} />}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <p className="text-xs font-medium text-slate-400 w-16 flex-shrink-0">{label}</p>
      <p className="text-xs text-slate-700">{value}</p>
    </div>
  );
}

function formatResidentName(data: unknown): string {
  if (!data || typeof data !== "object") return "New resident";
  const d = data as NewResidentData;
  return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || "New resident";
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
