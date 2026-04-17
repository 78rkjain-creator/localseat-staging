"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveAddressChangeRequest, rejectAddressChangeRequest } from "@/lib/address-changes";
import type { NewAddressData } from "@/lib/address-changes";

interface AddressSnapshot {
  streetNumber: string;
  streetName: string;
  unitNumber: string | null;
  city: string;
  province: string;
  postalCode: string;
}

interface Request {
  id: string;
  createdAt: Date;
  affectedPersonIds: string[];
  // Typed broadly because Prisma returns JsonValue; cast to NewAddressData at point of use
  newAddressData: unknown;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    household: {
      address: AddressSnapshot;
      people: { id: string; firstName: string; lastName: string }[];
    } | null;
  };
  requestedBy: { firstName: string; lastName: string };
}

interface ReviewClientProps {
  requests: Request[];
}

export function ReviewClient({ requests }: ReviewClientProps) {
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
        <p className="text-sm text-slate-400">No pending address change requests.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {requests.map((req) => (
        <RequestRow
          key={req.id}
          request={req}
          onReviewed={() => router.refresh()}
        />
      ))}
    </div>
  );
}

function RequestRow({
  request,
  onReviewed,
}: {
  request: Request;
  onReviewed: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const oldAddress = request.person.household?.address ?? null;
  const newData = request.newAddressData as NewAddressData;

  // Names of people affected beyond the primary person
  const allHouseholdMembers = request.person.household?.people ?? [];
  const alsoMoving = allHouseholdMembers.filter((m) =>
    request.affectedPersonIds.includes(m.id)
  );

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveAddressChangeRequest(request.id);
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
      const result = await rejectAddressChangeRequest(request.id);
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
          {done === "approved" ? "Approved — address updated" : "Rejected"}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4">
        {/* Requester + date */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {request.person.firstName} {request.person.lastName}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Requested by {request.requestedBy.firstName} {request.requestedBy.lastName}
              {" · "}
              {new Date(request.createdAt).toLocaleDateString("en-CA", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Address comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Current address
            </p>
            {oldAddress ? (
              <p className="text-sm text-slate-700 leading-relaxed">
                {oldAddress.streetNumber} {oldAddress.streetName}
                {oldAddress.unitNumber ? ` #${oldAddress.unitNumber}` : ""}
                <br />
                {oldAddress.city}, {oldAddress.province} {oldAddress.postalCode}
              </p>
            ) : (
              <p className="text-sm text-slate-400">No address on file</p>
            )}
          </div>
          <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold text-brand-400 uppercase tracking-wide mb-1.5">
              New address
            </p>
            <p className="text-sm text-brand-800 leading-relaxed">
              {newData.streetNumber} {newData.streetName}
              {newData.unitNumber ? ` #${newData.unitNumber}` : ""}
              <br />
              {newData.city}, {newData.province} {newData.postalCode}
            </p>
          </div>
        </div>

        {/* Also moving */}
        {alsoMoving.length > 0 && (
          <p className="text-xs text-slate-500 mb-4">
            <span className="font-medium">Also moving:</span>{" "}
            {alsoMoving.map((m) => `${m.firstName} ${m.lastName}`).join(", ")}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
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
