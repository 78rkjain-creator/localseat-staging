import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewDonors, canViewDonorAmounts } from "@/lib/permissions";
import { getAllDonorsForExport } from "@/lib/donors";
import { DONOR_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/types";
import type { Role, DonorStatus, PaymentMethod } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return new Response("No active campaign", { status: 400 });
  if (!activeRole || !canViewDonors(activeRole as Role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const showAmounts = canViewDonorAmounts(activeRole as Role);
  const donors = await getAllDonorsForExport(activeCampaignId);

  const headers = [
    "First Name", "Last Name", "Address", "City", "Province", "Postal Code",
    "Phone (home)", "Email",
    ...(showAmounts ? ["Amount", "Donation Date", "Payment Method"] : []),
    "Status", "Thank You Sent", "Thank You Date", "Notes",
  ];

  const rows = donors.map((d) => {
    const base = [
      d.firstName,
      d.lastName,
      d.address ?? "",
      d.city ?? "",
      d.province ?? "",
      d.postalCode ?? "",
      d.phoneHome ?? "",
      d.email ?? "",
    ];
    const financial = showAmounts ? [
      d.amount ? d.amount.toString() : "",
      d.donationDate ? d.donationDate.toISOString().split("T")[0] : "",
      d.paymentMethod ? (PAYMENT_METHOD_LABELS[d.paymentMethod as PaymentMethod] ?? d.paymentMethod) : "",
    ] : [];
    const rest = [
      DONOR_STATUS_LABELS[d.status as DonorStatus] ?? d.status,
      d.thankYouSent ? "Yes" : "No",
      d.thankYouDate ? d.thankYouDate.toISOString().split("T")[0] : "",
      d.notes ?? "",
    ];
    return [...base, ...financial, ...rest];
  });

  const csv = [headers, ...rows].map(csvRow).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="donors.csv"`,
    },
  });
}

function csvRow(fields: string[]): string {
  return fields.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",");
}
