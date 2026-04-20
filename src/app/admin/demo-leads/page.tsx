import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDemoLeads } from "./actions";
import { LeadsClient } from "./leads-client";

export default async function DemoLeadsPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  const { platformRole } = session.user;
  if (platformRole !== "super_user" && platformRole !== "super_admin") {
    redirect("/admin");
  }

  const leads = await getDemoLeads();

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Demo Leads</h1>
        <p className="text-slate-500 mt-1">
          Registrations from{" "}
          <span className="font-medium text-slate-700">demo.localseat.io</span>
          {" "}— grouped by email address.
        </p>
      </div>

      <LeadsClient initialLeads={leads} />
    </div>
  );
}
