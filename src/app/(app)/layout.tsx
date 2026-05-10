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
import { isMaintenanceMode } from "@/lib/maintenance";
import { isGotvMode } from "@/lib/gotv";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { EmailVerificationBanner } from "@/components/layout/email-verification-banner";
import { SupplierTopBar } from "@/components/layout/supplier-top-bar";
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
    emailVerified,
    platformRole: sessionPlatformRole,
  } = session.user;

  // Data suppliers get a stripped-down layout — supplier portal only.
  // The proxy already redirects them from all other routes.
  if (activeRole === "data_supplier") {
    const activeMembership = memberships.find((m) => m.campaignId === activeCampaignId);
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <SupplierTopBar
          firstName={firstName}
          lastName={lastName}
          campaignName={activeMembership?.campaignName ?? null}
        />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
          {children}
        </main>
      </div>
    );
  }

  // Fetch createdAt for the verification banner (only when needed).
  let accountCreatedAt: string | null = null;
  if (!emailVerified && !sessionPlatformRole) {
    const userRecord = await db.user.findUnique({
      where: { id: session.user.id },
      select: { createdAt: true },
    });
    accountCreatedAt = userRecord?.createdAt.toISOString() ?? null;
  }

  const inSupportMode = !!supportMode;

  // DB-driven maintenance gate — catches the admin-panel toggle without a
  // redeploy. ENV-based hard lockout is handled by the proxy. Admins are exempt.
  if (!inSupportMode) {
    const platformRole = session.user.platformRole;
    const isAdmin = platformRole === "super_user" || platformRole === "super_admin";
    if (!isAdmin) {
      const maintenance = await isMaintenanceMode();
      if (maintenance) {
        redirect("/maintenance");
      }
    }
  }

  // Municipality gate — redirect to municipality selection if the platform
  // setting requires it and the campaign hasn't selected one yet.
  if (activeCampaignId && !inSupportMode) {
    const platformSettingsRows = await db.platformSettings.findMany({
      where: { key: "municipality_selection_required" },
      select: { key: true, value: true },
    });
    const municipalityRequired = platformSettingsRows.find(
      (r) => r.key === "municipality_selection_required"
    )?.value === "true";
    if (municipalityRequired) {
      const campaignMunicipality = await db.campaign.findUnique({
        where:  { id: activeCampaignId },
        select: { municipalityName: true, plan: true },
      });
      // Demo campaigns and campaigns without a municipality bypass the gate
      const isDemo = campaignMunicipality?.plan === "demo";
      if (!isDemo && !campaignMunicipality?.municipalityName) {
        redirect(`/onboarding/select-municipality?campaignId=${activeCampaignId}&required=true`);
      }
    }
  }

  // Payment gate — unpaid campaigns are redirected to plan selection before
  // any page content, sidebar, or feature queries run. Super_users in support
  // mode bypass the gate so they can view any campaign state.
  if (
    activeCampaignId &&
    process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true" &&
    !inSupportMode
  ) {
    const campaignPaymentState = await db.campaign.findUnique({
      where:  { id: activeCampaignId },
      select: { planActivated: true, plan: true },
    });
    if (campaignPaymentState && !campaignPaymentState.planActivated && campaignPaymentState.plan !== "demo") {
      redirect(`/onboarding/choose-plan?campaignId=${activeCampaignId}`);
    }
  }

  const activeMembership = memberships.find(
    (m) => m.campaignId === activeCampaignId
  );

  // Fetch campaign logo for sidebar branding
  const campaignLogoUrl = activeCampaignId
    ? (await db.campaign.findUnique({
        where: { id: activeCampaignId },
        select: { logoUrl: true },
      }))?.logoUrl ?? null
    : null;

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
  let tagUsage: { count: number; limit: number } | null = null;

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
      if (!limits.isUnlimited("tagLimit") && limits.tagLimit > 0) {
        const count = await db.tag.count({ where: { campaignId: activeCampaignId, deletedAt: null } });
        tagUsage = { count, limit: limits.tagLimit };
      }
    }
  }

  const gotvMode = activeCampaignId ? await isGotvMode(activeCampaignId) : false;

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
      {accountCreatedAt && (
        <EmailVerificationBanner email={email} accountCreatedAt={accountCreatedAt} />
      )}
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
          campaignLogoUrl={campaignLogoUrl}
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
          tagUsage={tagUsage}
        />
        <main className="flex-1 min-w-0 bg-slate-50 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav gotvMode={gotvMode} />
      <PwaInstallPrompt />
    </div>
  );
}
