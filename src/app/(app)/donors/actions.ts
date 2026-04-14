"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewDonorAmounts, canViewDonors } from "@/lib/permissions";
import type { DonorStatus, PaymentMethod, Role } from "@/types";

// ── Auth guard ─────────────────────────────────────────────────────────────

async function requireDonorAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canViewDonors(activeRole as Role)) {
    return { error: "You don't have permission to manage donors." } as const;
  }

  return { session, campaignId: activeCampaignId, role: activeRole as Role } as const;
}

// ── Add donor manually ─────────────────────────────────────────────────────

export interface AddDonorInput {
  firstName: string;
  lastName: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  amount?: string;
  donationDate?: string;
  status: DonorStatus;
  paymentMethod?: PaymentMethod;
  notes?: string;
  linkedPersonId?: string;
}

export async function addDonor(
  input: AddDonorInput
): Promise<{ error?: string; donorId?: string }> {
  const auth = await requireDonorAccess();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) return { error: "First and last name are required." };

  const donor = await db.donor.create({
    data: {
      campaignId,
      firstName,
      lastName,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      amount: input.amount ? parseFloat(input.amount) : null,
      donationDate: input.donationDate ? new Date(input.donationDate) : null,
      status: input.status,
      paymentMethod: input.paymentMethod || null,
      notes: input.notes?.trim() || null,
      linkedPersonId: input.linkedPersonId || null,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  revalidatePath("/donors");
  return { donorId: donor.id };
}

// ── Update donor ───────────────────────────────────────────────────────────

export interface UpdateDonorInput {
  donorId: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  amount?: string;
  donationDate?: string;
  status?: DonorStatus;
  paymentMethod?: PaymentMethod | "";
  thankYouSent?: boolean;
  thankYouDate?: string;
  notes?: string;
}

export async function updateDonor(
  input: UpdateDonorInput
): Promise<{ error?: string }> {
  const auth = await requireDonorAccess();
  if ("error" in auth) return auth;
  const { campaignId, role } = auth;

  const donor = await db.donor.findFirst({
    where: { id: input.donorId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!donor) return { error: "Donor not found." };

  const canAmounts = canViewDonorAmounts(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (input.firstName !== undefined) data.firstName = input.firstName.trim();
  if (input.lastName !== undefined) data.lastName = input.lastName.trim();
  if (input.address !== undefined) data.address = input.address.trim() || null;
  if (input.city !== undefined) data.city = input.city.trim() || null;
  if (input.province !== undefined) data.province = input.province.trim() || null;
  if (input.postalCode !== undefined) data.postalCode = input.postalCode.trim() || null;
  if (input.phone !== undefined) data.phone = input.phone.trim() || null;
  if (input.email !== undefined) data.email = input.email.trim() || null;
  if (input.status !== undefined) data.status = input.status;
  if (input.notes !== undefined) data.notes = input.notes.trim() || null;
  if (input.thankYouSent !== undefined) {
    data.thankYouSent = input.thankYouSent;
    if (input.thankYouSent && input.thankYouDate) {
      data.thankYouDate = new Date(input.thankYouDate);
    }
  }
  // Amount and payment method restricted to roles with financial access
  if (canAmounts) {
    if (input.amount !== undefined) data.amount = input.amount ? parseFloat(input.amount) : null;
    if (input.donationDate !== undefined) data.donationDate = input.donationDate ? new Date(input.donationDate) : null;
    if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod || null;
  }

  await db.donor.update({ where: { id: input.donorId }, data });
  revalidatePath("/donors");
  revalidatePath(`/donors/${input.donorId}`);
  return {};
}

// ── Delete (soft) ──────────────────────────────────────────────────────────

export async function deleteDonor(
  donorId: string
): Promise<{ error?: string }> {
  const auth = await requireDonorAccess();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const donor = await db.donor.findFirst({
    where: { id: donorId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!donor) return { error: "Donor not found." };

  await db.donor.update({
    where: { id: donorId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/donors");
  return {};
}
