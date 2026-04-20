"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewDonorAmounts, canViewDonors } from "@/lib/permissions";
import { sanitizeEmail, sanitizePhone, sanitizeAmount, sanitizeDate, sanitizeEnum } from "@/lib/sanitize";
import { createAuditLog } from "@/lib/audit";
import { isDonorTrackingEnabled } from "@/lib/plan-limits";
import type { DonorStatus, PaymentMethod, Role } from "@/types";

const DONOR_STATUS_VALUES: DonorStatus[] = ["interested", "pledged", "received"];
const PAYMENT_METHOD_VALUES: PaymentMethod[] = ["cash", "cheque", "e_transfer", "other"];

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
  phoneHome?: string;
  phoneMobile?: string;
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

  const status = sanitizeEnum(input.status, DONOR_STATUS_VALUES);
  if (!status) return { error: "Invalid donor status." };

  const donorEnabled = await isDonorTrackingEnabled(campaignId);
  if (!donorEnabled) {
    return { error: "Donor tracking is not available on the Starter plan." };
  }

  const donor = await db.donor.create({
    data: {
      campaignId,
      firstName,
      lastName,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      phoneHome: sanitizePhone(input.phoneHome),
      phoneMobile: sanitizePhone(input.phoneMobile),
      email: sanitizeEmail(input.email),
      amount: sanitizeAmount(input.amount),
      donationDate: sanitizeDate(input.donationDate),
      status,
      paymentMethod: sanitizeEnum(input.paymentMethod, PAYMENT_METHOD_VALUES),
      notes: input.notes?.trim() || null,
      linkedPersonId: input.linkedPersonId || null,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "DONOR_CREATED",
    entityType: "donor",
    entityId: donor.id,
    details: { firstName, lastName, status },
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
  phoneHome?: string;
  phoneMobile?: string;
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
  if (input.phoneHome !== undefined) data.phoneHome = sanitizePhone(input.phoneHome);
  if (input.phoneMobile !== undefined) data.phoneMobile = sanitizePhone(input.phoneMobile);
  if (input.email !== undefined) data.email = sanitizeEmail(input.email);
  if (input.status !== undefined) {
    const status = sanitizeEnum(input.status, DONOR_STATUS_VALUES);
    if (status !== null) data.status = status;
  }
  if (input.notes !== undefined) data.notes = input.notes.trim() || null;
  if (input.thankYouSent !== undefined) {
    data.thankYouSent = input.thankYouSent;
    if (input.thankYouSent && input.thankYouDate) {
      data.thankYouDate = sanitizeDate(input.thankYouDate);
    }
  }
  // Amount and payment method restricted to roles with financial access
  if (canAmounts) {
    if (input.amount !== undefined) data.amount = sanitizeAmount(input.amount);
    if (input.donationDate !== undefined) data.donationDate = sanitizeDate(input.donationDate);
    if (input.paymentMethod !== undefined) data.paymentMethod = sanitizeEnum(input.paymentMethod as string, PAYMENT_METHOD_VALUES);
  }

  await db.donor.update({ where: { id: input.donorId }, data });

  await createAuditLog({
    campaignId,
    userId: auth.session.user.id,
    action: "DONOR_UPDATED",
    entityType: "donor",
    entityId: input.donorId,
    details: { fields: Object.keys(data) },
  });

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

  await createAuditLog({
    campaignId,
    userId: auth.session.user.id,
    action: "DONOR_DELETED",
    entityType: "donor",
    entityId: donorId,
  });

  revalidatePath("/donors");
  return {};
}
