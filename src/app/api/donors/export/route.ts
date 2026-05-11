export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewDonors, canViewDonorAmounts } from "@/lib/permissions";
import { isDonorTrackingEnabled } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import { DONOR_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/types";
import { csvRow, streamingCsvResponse } from "@/lib/csv-stream";
import type { Role, DonorStatus, PaymentMethod } from "@/types";

const CHUNK_SIZE = 500;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return new Response("No active campaign", { status: 400 });
  if (!activeRole || !canViewDonors(activeRole as Role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const donorEnabled = await isDonorTrackingEnabled(activeCampaignId);
  if (!donorEnabled) {
    return new Response("Donor tracking is not available on your current plan.", { status: 403 });
  }

  const membership = await db.campaignMembership.findFirst({
    where: { userId: session.user.id, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!membership) return new Response("Forbidden", { status: 403 });

  const showAmounts = canViewDonorAmounts(activeRole as Role);

  try {
    let totalRows = 0;

    const headers = [
      "First Name", "Last Name", "Address", "City", "Province", "Postal Code",
      "Phone (home)", "Phone (mobile)", "Email",
      ...(showAmounts ? ["Amount", "Donation Date", "Payment Method"] : []),
      "Status", "Thank You Sent", "Thank You Date", "Notes",
    ];

    const response = streamingCsvResponse(
      "donors.csv",
      headers,
      async (enqueue) => {
        let cursor: string | undefined;

        while (true) {
          const donors = await db.donor.findMany({
            where: { campaignId: activeCampaignId, deletedAt: null },
            include: {
              linkedPerson: {
                select: {
                  household: {
                    select: {
                      address: {
                        select: {
                          streetNumber: true, streetName: true, unitNumber: true,
                          city: true, province: true, postalCode: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { id: "asc" },
            take: CHUNK_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          });

          if (donors.length === 0) break;

          for (const d of donors) {
            const addr = d.linkedPerson?.household?.address;
            const address = addr
              ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
              : (d as Record<string, unknown>).address ?? "";

            const base: string[] = [
              d.firstName, d.lastName,
              address as string, addr?.city ?? "", addr?.province ?? "", addr?.postalCode ?? "",
              d.phoneHome ?? "", d.phoneMobile ?? "", d.email ?? "",
            ];
            const financial: string[] = showAmounts ? [
              d.amount ? d.amount.toString() : "",
              d.donationDate ? d.donationDate.toISOString().split("T")[0] : "",
              d.paymentMethod ? (PAYMENT_METHOD_LABELS[d.paymentMethod as PaymentMethod] ?? d.paymentMethod) : "",
            ] : [];
            const rest: string[] = [
              DONOR_STATUS_LABELS[d.status as DonorStatus] ?? d.status,
              d.thankYouSent ? "Yes" : "No",
              d.thankYouDate ? d.thankYouDate.toISOString().split("T")[0] : "",
              d.notes ?? "",
            ];

            enqueue(csvRow([...base, ...financial, ...rest]));
          }

          totalRows += donors.length;
          cursor = donors[donors.length - 1].id;
          if (donors.length < CHUNK_SIZE) break;
        }

        await createAuditLog({
          campaignId: activeCampaignId,
          userId: session.user.id,
          action: "EXPORT_DONORS",
          entityType: "export",
          details: {
            rowCount: totalRows,
            userRole: activeRole,
            format: "csv",
          },
        });
      }
    );

    return response;
  } catch {
    return Response.json({ error: "Export failed." }, { status: 500 });
  }
}
