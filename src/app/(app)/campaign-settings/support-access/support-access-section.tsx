import { getSupportAccessStatus } from "@/lib/support-access";
import {
  approveSupportAccessAction,
  denySupportAccessAction,
  revokeSupportAccessAction,
} from "./actions";

function formatDatetime(d: Date): string {
  return new Date(d).toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function SupportAccessSection({ campaignId }: { campaignId: string }) {
  const status = await getSupportAccessStatus(campaignId);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Support Access</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Control whether the LocalSeat support team can access your campaign data.
        </p>
      </div>

      {/* No request / expired / denied / revoked */}
      {(status.status === "none" || status.status === "expired" || status.status === "denied" || status.status === "revoked") && (
        <p className="text-sm text-slate-500">
          No active support access. The LocalSeat support team will request access if they need to help troubleshoot your campaign.
        </p>
      )}

      {/* Pending request */}
      {status.status === "pending" && status.grantId && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
            <p className="text-sm font-medium text-blue-800">
              {status.requestedByName ?? "The LocalSeat support team"} has requested temporary editing access to your campaign.
            </p>
            {status.requestNote && (
              <p className="text-sm text-blue-700 mt-1">Note: {status.requestNote}</p>
            )}
            {status.requestedAt && (
              <p className="text-xs text-blue-500 mt-1">Requested {formatDatetime(status.requestedAt)}</p>
            )}
          </div>
          <p className="text-sm text-slate-500">
            If approved, access expires after 72 hours. All actions taken by the support team are recorded in your audit log.
          </p>
          <div className="flex items-center gap-2">
            <form action={approveSupportAccessAction.bind(null, status.grantId)}>
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
              >
                Approve (72 hours)
              </button>
            </form>
            <form action={denySupportAccessAction.bind(null, status.grantId)}>
              <button
                type="submit"
                className="h-9 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Deny
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Active access */}
      {status.status === "active" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
            <p className="text-sm font-medium text-emerald-800">
              Support access is active
            </p>
            {status.expiresAt && (
              <p className="text-sm text-emerald-700 mt-0.5">
                Expires {formatDatetime(status.expiresAt)}
              </p>
            )}
            {status.approvedByName && (
              <p className="text-xs text-emerald-600 mt-0.5">Approved by {status.approvedByName}</p>
            )}
          </div>
          <p className="text-sm text-slate-500">
            All editing actions by the support team are recorded in your audit log.
          </p>
          <form action={revokeSupportAccessAction}>
            <button
              type="submit"
              className="h-9 px-4 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium transition-colors"
            >
              Revoke access
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
