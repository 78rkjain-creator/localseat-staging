import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (!session.user.platformRole) {
    redirect("/dashboard");
  }

  const { firstName, lastName, platformRole } = session.user;

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar
        firstName={firstName}
        lastName={lastName}
        platformRole={platformRole}
      />
      {/* md:pt-0 resets the mobile topbar offset inside the scrollable main */}
      <main className="flex-1 min-w-0 bg-slate-50 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
