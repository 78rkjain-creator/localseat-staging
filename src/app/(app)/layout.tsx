import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { DemoBanner } from "@/components/layout/demo-banner";
import { SupportBanner } from "@/components/layout/support-banner";
import { SupportAccessRequestBanner } from "@/components/layout/support-access-request-banner";
import { MobileNav } from "@/components/layout/mobile-nav";
import { canReviewAddressChanges } from "@/lib/permissions";
import { getPendingAddressChangeCount } from "@/lib/address-changes";
import { getPendingVoterChangeCount } from "@/lib/voter-change-requests";
import { getEffectiveLimits } from "@/lib/plan-limits";
import { hasPendingRequest } from "@/lib/support-access";
import type { Role } from "@/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const {
    email,
    firstName,
    lastName,
    activeCampaignId,
    activeRole,
    memberships,
    supportMode,
    supportCampaignName,
  } = session.user;

  const activeMembership = memberships.find(
    (m) => m.campaignId === activeCampaignId
  );

  const demoMode = process.env.DEMO_MODE === "true";

  const pendingDataCorrectionsCount = activeCampaignId && activeRole && canReviewAddressChanges(activeRole as Role)
    ? await Promise.all([
        getPendingAddressChangeCount(activeCampaignId),
        getPendingVoterChangeCount(activeCampaignId),
      ]).then(([a, b]) => a + b)
    : 0;

  // Load effective limits for plan-gating in sidebar
  let donorTrackingEnabled     = true;
  let followUpQueueEnabled     = true;
  let analyticsEnabled         = true;
  let eventsEnabled            = true;
  let surveysEnabled           = true;
  let digitalSignaturesEnabled = true;
  let customFieldsEnabled      = true;
  let signTrackingEnabled      = true;
  let contactMapEnabled        = true;
  let reportsEnabled           = true;
  let canvassScriptEnabled     = true;
  let constituentUsage: { count: number; limit: number } | null = null;

  // Check for pending support access request (candidate/campaign_manager only)
  let pendingSupportRequest: {
    grantId: string;
    requesterName: string;
    requestNote: string | null | undefined;
    requestedAt: Date | undefined;
  } | null = null;

  if (
    activeCampaignId &&
    !supportMode && // don't show banner while already in support mode
    (activeRole === "candidate" || activeRole === "campaign_manager")
  ) {
    const pending = await hasPendingRequest(activeCampaignId);
    if (pending.pending && pending.grantId) {
      pendingSupportRequest = {
        grantId: pending.grantId,
        requesterName: pending.requestedBy ?? "Support",
        requestNote: pending.requestNote,
        requestedAt: pending.requestedAt,
      };
    }
  }

  if (activeCampaignId) {
    const limits = await getEffectiveLimits(activeCampaignId);
    donorTrackingEnabled     = limits.donorTrackingEnabled;
    followUpQueueEnabled     = limits.followUpQueueEnabled;
    analyticsEnabled         = limits.analyticsEnabled;
    eventsEnabled            = limits.eventsEnabled;
    surveysEnabled           = limits.surveysEnabled;
    digitalSignaturesEnabled = limits.digitalSignaturesEnabled;
    customFieldsEnabled      = limits.customFieldsEnabled;
    signTrackingEnabled      = limits.signTrackingEnabled;
    contactMapEnabled        = limits.contactMapEnabled;
    reportsEnabled           = limits.reportsEnabled;
    canvassScriptEnabled     = limits.canvassScriptEnabled;

    if (activeRole === "candidate" || activeRole === "campaign_manager") {
      if (!limits.isUnlimited("constituentLimit") && limits.constituentLimit > 0) {
        const count = await db.person.count({ where: { campaignId: activeCampaignId, deletedAt: null } });
        constituentUsage = { count, limit: limits.constituentLimit };
      }
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {supportMode && (
        <SupportBanner
          campaignName={supportCampaignName ?? "Unknown campaign"}
          mode={supportMode}
          expiresAt={null}
        />
      )}
      {!supportMode && demoMode && <DemoBanner currentEmail={email} />}
      {pendingSupportRequest && (
        <SupportAccessRequestBanner
          grantId={pendingSupportRequest.grantId}
          requesterName={pendingSupportRequest.requesterName}
          requestNote={pendingSupportRequest.requestNote}
          requestedAt={pendingSupportRequest.requestedAt}
        />
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          firstName={firstName}
          lastName={lastName}
          role={activeRole as Role | null}
          campaignName={activeMembership?.campaignName ?? null}
          campaignCount={memberships.length}
          pendingDataCorrectionsCount={pendingDataCorrectionsCount}
          donorTrackingEnabled={donorTrackingEnabled}
          followUpQueueEnabled={followUpQueueEnabled}
          analyticsEnabled={analyticsEnabled}
          eventsEnabled={eventsEnabled}
          surveysEnabled={surveysEnabled}
          digitalSignaturesEnabled={digitalSignaturesEnabled}
          customFieldsEnabled={customFieldsEnabled}
          signTrackingEnabled={signTrackingEnabled}
          contactMapEnabled={contactMapEnabled}
          reportsEnabled={reportsEnabled}
          canvassScriptEnabled={canvassScriptEnabled}
          constituentUsage={constituentUsage}
        />
        <main className="flex-1 min-w-0 bg-slate-50 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
