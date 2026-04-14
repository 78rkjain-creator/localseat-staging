import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { firstName, lastName, activeCampaignId, activeRole, memberships } =
    session.user;

  const activeMembership = memberships.find(
    (m) => m.campaignId === activeCampaignId
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        firstName={firstName}
        lastName={lastName}
        role={activeRole}
        campaignName={activeMembership?.campaignName ?? null}
      />
      <main className="flex-1 min-w-0 bg-slate-50 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
