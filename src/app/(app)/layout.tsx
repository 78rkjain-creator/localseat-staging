import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { DemoBanner } from "@/components/layout/demo-banner";
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
        />
        <main className="flex-1 min-w-0 bg-slate-50 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
