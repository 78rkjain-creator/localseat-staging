import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ codeId: string }>;
}

export default async function PromoCodeDetailPage({ params }: Props) {
  const { codeId } = await params;

  const promo = await db.promoCode.findUnique({
    where: { id: codeId },
    include: {
      campaigns: {
        where: { deletedAt: null },
        orderBy: { planLockedAt: "desc" },
        select: {
          id: true,
          name: true,
          plan: true,
          amountPaid: true,
          planLockedAt: true,
        },
      },
    },
  });

  if (!promo) notFound();

  const discountTotal = promo.campaigns.reduce((sum, c) => {
    if (!c.amountPaid) return sum;
    const full = Math.round(c.amountPaid / (1 - promo.discountPercent / 100));
    return sum + (full - c.amountPaid);
  }, 0);

  return (
    <div className="px-8 py-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/admin/promo-codes"
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          ← Promo codes
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 font-mono">{promo.code}</h1>
            <p className="text-sm text-slate-500 mt-1">{promo.referrerName}{promo.referrerEmail ? ` · ${promo.referrerEmail}` : ""}</p>
          </div>
          <span className={[
            "inline-flex px-3 py-1 rounded-full text-xs font-semibold",
            promo.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500",
          ].join(" ")}>
            {promo.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Discount</dt>
            <dd className="text-xl font-semibold text-slate-900">{promo.discountPercent}%</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Uses</dt>
            <dd className="text-xl font-semibold text-slate-900">
              {promo.usageCount}{promo.maxUses !== null ? ` / ${promo.maxUses}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Total revenue</dt>
            <dd className="text-xl font-semibold text-slate-900">${promo.totalRevenue.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Total discounts</dt>
            <dd className="text-xl font-semibold text-slate-500">${promo.totalDiscounts.toLocaleString()}</dd>
          </div>
        </dl>

        {promo.expiresAt && (
          <p className="mt-4 text-xs text-slate-400">
            Expires {new Date(promo.expiresAt).toLocaleDateString("en-CA")}
          </p>
        )}
        {promo.stripeCouponId && (
          <p className="mt-1 text-xs text-slate-400">Stripe coupon: <code className="font-mono">{promo.stripeCouponId}</code></p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            Campaigns using this code ({promo.campaigns.length})
          </h2>
        </div>

        {promo.campaigns.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-400">No campaigns have used this code yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Campaign</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount paid</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Discount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promo.campaigns.map((c) => {
                const full = c.amountPaid
                  ? Math.round(c.amountPaid / (1 - promo.discountPercent / 100))
                  : null;
                const discount = full && c.amountPaid ? full - c.amountPaid : null;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/campaigns/${c.id}`}
                        className="font-medium text-slate-900 hover:text-brand-600 transition-colors"
                      >
                        {c.name}
                      </Link>
                      {c.planLockedAt && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(c.planLockedAt).toLocaleDateString("en-CA")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="capitalize text-slate-700">{c.plan}</span>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-slate-900">
                      {c.amountPaid != null ? `$${c.amountPaid}` : "—"}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      {discount != null ? `$${discount}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={2} className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  ${promo.campaigns.reduce((s, c) => s + (c.amountPaid ?? 0), 0).toLocaleString()}
                </td>
                <td className="px-6 py-3 text-right font-semibold text-slate-500">${discountTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
