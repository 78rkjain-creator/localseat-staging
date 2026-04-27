import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ContactSubmissionsClient } from "./contact-submissions-client";

export default async function ContactSubmissionsPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  const { platformRole } = session.user;
  if (platformRole !== "super_user" && platformRole !== "super_admin") {
    redirect("/admin");
  }

  const submissions = await db.contactSubmission.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Contact Submissions</h1>
        <p className="text-slate-500 mt-1">
          Messages submitted from the{" "}
          <span className="font-medium text-slate-700">localseat.io</span>{" "}
          contact form.
        </p>
      </div>

      <ContactSubmissionsClient initialSubmissions={submissions} />
    </div>
  );
}
