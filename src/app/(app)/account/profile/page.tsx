import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true, email: true, phoneHome: true, phoneMobile: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Your profile</h1>
      <ProfileForm
        firstName={user.firstName}
        lastName={user.lastName}
        email={user.email}
        phoneHome={user.phoneHome}
        phoneMobile={user.phoneMobile}
      />
    </div>
  );
}
