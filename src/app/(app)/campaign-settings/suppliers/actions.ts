"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageSuppliers } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";
import type { Role } from "@/types";

async function requireSupplierManager() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canManageSuppliers(activeRole as Role)) {
    return { error: "You don't have permission to manage suppliers." } as const;
  }
  return { session, campaignId: activeCampaignId } as const;
}

export interface InviteSupplierInput {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  supplierLoginEmail: string;
  temporaryPassword: string;
  // Step 2 — acknowledgement
  signedName: string;
  signedEmail: string;
  signatureData: string;
}

export async function inviteSupplier(input: InviteSupplierInput): Promise<{
  error?: string;
  credentials?: { email: string; password: string };
}> {
  const auth = await requireSupplierManager();
  if ("error" in auth) return auth;
  const { campaignId, session } = auth;

  const { user } = session;
  const expectedName = `${user.firstName} ${user.lastName}`.toLowerCase().trim();
  const inputName = input.signedName.toLowerCase().trim();
  if (inputName !== expectedName) {
    return { error: "Signed name does not match your account name." };
  }
  if (input.signedEmail.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
    return { error: "Signed email does not match your account email." };
  }
  if (!input.signatureData) {
    return { error: "Signature is required." };
  }

  const loginEmail = input.supplierLoginEmail.toLowerCase().trim();

  // Check if user already exists
  let supplierUser = await db.user.findUnique({ where: { email: loginEmail } });

  if (supplierUser) {
    // Check if they already have a membership for this campaign
    const existing = await db.campaignMembership.findUnique({
      where: { userId_campaignId: { userId: supplierUser.id, campaignId } },
    });
    if (existing && !existing.deletedAt) {
      return { error: "This user already has an active membership in this campaign." };
    }
    // Restore or update the existing membership
    if (existing) {
      await db.campaignMembership.update({
        where: { id: existing.id },
        data: {
          role: "data_supplier",
          company: input.companyName,
          companyPhone: input.companyPhone || null,
          companyEmail: input.companyEmail,
          deletedAt: null,
        },
      });
    } else {
      await db.campaignMembership.create({
        data: {
          userId: supplierUser.id,
          campaignId,
          role: "data_supplier",
          company: input.companyName,
          companyPhone: input.companyPhone || null,
          companyEmail: input.companyEmail,
        },
      });
    }
  } else {
    // Create a new user for the supplier
    const passwordHash = await bcrypt.hash(input.temporaryPassword, 12);
    supplierUser = await db.user.create({
      data: {
        email: loginEmail,
        passwordHash,
        firstName: input.companyName,
        lastName: "Supplier",
        emailVerified: new Date(),
      },
    });
    await db.campaignMembership.create({
      data: {
        userId: supplierUser.id,
        campaignId,
        role: "data_supplier",
        company: input.companyName,
        companyPhone: input.companyPhone || null,
        companyEmail: input.companyEmail,
      },
    });
  }

  // Save the signed acknowledgement
  await db.supplierAcknowledgement.create({
    data: {
      campaignId,
      signedById: user.id,
      signedName: input.signedName,
      signedEmail: input.signedEmail,
      signatureData: input.signatureData,
      supplierEmail: loginEmail,
      supplierCompany: input.companyName,
    },
  });

  await createAuditLog({
    campaignId,
    userId: user.id,
    action: "DATA_SUPPLIER_INVITED",
    entityType: "campaign_membership",
    entityId: supplierUser.id,
    details: { supplierEmail: loginEmail, companyName: input.companyName },
  });

  revalidatePath("/campaign-settings/suppliers");
  return { credentials: { email: loginEmail, password: input.temporaryPassword } };
}

export async function revokeSupplierAccess(membershipId: string): Promise<{ error?: string }> {
  const auth = await requireSupplierManager();
  if ("error" in auth) return auth;
  const { campaignId, session } = auth;

  const membership = await db.campaignMembership.findFirst({
    where: { id: membershipId, campaignId, role: "data_supplier" },
  });
  if (!membership) return { error: "Membership not found." };

  await db.campaignMembership.update({
    where: { id: membershipId },
    data: { deletedAt: new Date() },
  });

  // Bump sessionVersion to invalidate the supplier's active session
  await db.user.update({
    where: { id: membership.userId },
    data: { sessionVersion: { increment: 1 } },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "DATA_SUPPLIER_REVOKED",
    entityType: "campaign_membership",
    entityId: membershipId,
  });

  revalidatePath("/campaign-settings/suppliers");
  return {};
}

export async function restoreSupplierAccess(membershipId: string): Promise<{ error?: string }> {
  const auth = await requireSupplierManager();
  if ("error" in auth) return auth;
  const { campaignId, session } = auth;

  const membership = await db.campaignMembership.findFirst({
    where: { id: membershipId, campaignId, role: "data_supplier" },
  });
  if (!membership) return { error: "Membership not found." };

  await db.campaignMembership.update({
    where: { id: membershipId },
    data: { deletedAt: null },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "DATA_SUPPLIER_RESTORED",
    entityType: "campaign_membership",
    entityId: membershipId,
  });

  revalidatePath("/campaign-settings/suppliers");
  return {};
}
