import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NotFoundFallback } from "./not-found-fallback";

export default async function NotFound() {
  const session = await getServerSession(authOptions);

  if (session) {
    const { platformRole, activeCampaignId } = session.user;
    if (platformRole === "super_user" || platformRole === "super_admin") {
      redirect("/admin");
    }
    if (activeCampaignId) {
      redirect("/dashboard");
    }
    redirect("/select-campaign");
  }

  return <NotFoundFallback />;
}
