import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isSuperUser } from "@/lib/permissions";
import { getPlatformSettings } from "./actions";
import { SettingsClient } from "./settings-client";

export default async function PlatformSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) redirect("/login");

  const { platformRole } = session.user;

  // super_admin may view read-only; all others bounce to /admin
  if (platformRole !== "super_user" && platformRole !== "super_admin") {
    redirect("/admin");
  }

  const settings = await getPlatformSettings();
  const canEdit = isSuperUser(platformRole);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Platform Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage tier pricing, limits, and platform configuration.
        </p>
      </div>

      <SettingsClient initialSettings={settings} canEdit={canEdit} />
    </div>
  );
}
