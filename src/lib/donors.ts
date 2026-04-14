import { db } from "@/lib/db";
import type { DonorStatus } from "@/types";

// ── List ───────────────────────────────────────────────────────────────────

export interface DonorFilters {
  campaignId: string;
  status?: DonorStatus | "";
  thankYouSent?: "yes" | "no" | "";
  page?: number;
}

const PAGE_SIZE = 30;

export async function getDonors({
  campaignId,
  status,
  thankYouSent,
  page = 1,
}: DonorFilters) {
  const skip = (page - 1) * PAGE_SIZE;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { campaignId, deletedAt: null };
  if (status) where.status = status;
  if (thankYouSent === "yes") where.thankYouSent = true;
  if (thankYouSent === "no") where.thankYouSent = false;

  const [donors, total] = await Promise.all([
    db.donor.findMany({
      where,
      include: {
        linkedPerson: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
    }),
    db.donor.count({ where }),
  ]);

  return { donors, total, totalPages: Math.ceil(total / PAGE_SIZE) };
}

// ── Detail ─────────────────────────────────────────────────────────────────

export async function getDonorDetail(donorId: string, campaignId: string) {
  return db.donor.findFirst({
    where: { id: donorId, campaignId, deletedAt: null },
    include: {
      linkedPerson: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          household: {
            select: {
              address: {
                select: {
                  streetNumber: true,
                  streetName: true,
                  unitNumber: true,
                  city: true,
                  province: true,
                  postalCode: true,
                },
              },
            },
          },
        },
      },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

// ── All for export ─────────────────────────────────────────────────────────

export async function getAllDonorsForExport(campaignId: string) {
  return db.donor.findMany({
    where: { campaignId, deletedAt: null },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}
