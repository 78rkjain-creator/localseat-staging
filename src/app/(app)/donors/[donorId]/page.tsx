import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewDonors, canViewDonorAmounts } from "@/lib/permissions";
import { getDonorDetail } from "@/lib/donors";
import { Card } from "@/components/ui/card";
import { DonorDetailClient } from "./donor-detail-client";
import type { Role } from "@/types";

interface PageProps {
  params: Promise<{ donorId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return { title: "Donor" };
}

export default async function DonorDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewDonors(activeRole as Role)) redirect("/dashboard");

  const { donorId } = await params;
  const donor = await getDonorDetail(donorId, activeCampaignId);
  if (!donor) notFound();

  const showAmounts = canViewDonorAmounts(activeRole as Role);

  // Serialize Decimal and Date for client component
  const serialized = {
    id: donor.id,
    firstName: donor.firstName,
    lastName: donor.lastName,
    address: donor.address,
    city: donor.city,
    province: donor.province,
    postalCode: donor.postalCode,
    phone: donor.phone,
    email: donor.email,
    amount: donor.amount ? donor.amount.toString() : null,
    donationDate: donor.donationDate ?? null,
    status: donor.status,
    paymentMethod: donor.paymentMethod,
    thankYouSent: donor.thankYouSent,
    thankYouDate: donor.thankYouDate ?? null,
    notes: donor.notes,
    linkedPerson: donor.linkedPerson ?? null,
    createdBy: donor.createdBy ?? null,
    createdAt: donor.createdAt,
  };

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/donors"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Donors
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold text-slate-500">
            {donor.firstName[0]}{donor.lastName[0]}
          </span>
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-2xl font-bold text-slate-900">
            {donor.firstName} {donor.lastName}
          </h1>
        </div>
      </div>

      <Card padding="md">
        <DonorDetailClient donor={serialized} showAmounts={showAmounts} />
      </Card>
    </div>
  );
}
