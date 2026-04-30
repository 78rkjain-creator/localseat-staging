import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { DemoBanner } from "@/components/layout/demo-banner";
import { MobileNav } from "@/components/layout/mobile-nav";
import { canReviewAddressChanges } from "@/lib/permissions";
import { getPendingAddressChangeCount } from "@/lib/address-changes";
import { getPendingVoterChangeCount } from "@/lib/voter-change-requests";
import { getPendingOutOfDistrictCount } from "@/lib/people";
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

  const { email, firstName, lastName, activeCampaignId, activeRole, memberships } =
    session.user;

  const activeMembership = memberships.find(
    (m) => m.campaignId === activeCampaignId
  );

  const demoMode = process.env.DEMO_MODE === "true";

  const isFullAccess = activeRole === "candidate" || activeRole === "campaign_manager" || activeRole === "data_manager";

  const [pendingDataCorrectionsCount, pendingOutOfDistrictCount] = await Promise.all([
    activeCampaignId && activeRole && canReviewAddressChanges(activeRole as Role)
      ? Promise.all([
          getPendingAddressChangeCount(activeCampaignId),
          getPendingVoterChangeCount(activeCampaignId),
        ]).then(([a, b]) => a + b)
      : Promise.resolve(0),
    activeCampaignId && isFullAccess
      ? getPendingOutOfDistrictCount(activeCampaignId)
      : Promise.resolve(0),
  ]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {demoMode && <DemoBanner currentEmail={email} />}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          firstName={firstName}
          lastName={lastName}
          role={activeRole as Role | null}
          campaignName={activeMembership?.campaignName ?? null}
          campaignCount={memberships.length}
          pendingDataCorrectionsCount={pendingDataCorrectionsCount}
          pendingOutOfDistrictCount={pendingOutOfDistrictCount}
        />
        <main className="flex-1 min-w-0 bg-slate-50 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
