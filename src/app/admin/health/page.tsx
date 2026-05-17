import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSuperUser } from "@/lib/permissions";
import { BackupHealthCard } from "@/components/admin-health/backup-health-card";
import { BackupHistoryTable } from "@/components/admin-health/backup-history-table";
import { SystemMetricsCards } from "@/components/admin-health/system-metrics-cards";

export const dynamic = "force-dynamic";

async function getBackupData() {
  const [lastSuccess, lastAttempt, recentRuns, successCount30d, failCount30d] = await Promise.all([
    db.backupRun.findFirst({
      where: { success: true },
      orderBy: { startedAt: "desc" },
    }),
    db.backupRun.findFirst({
      orderBy: { startedAt: "desc" },
    }),
    db.backupRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 25,
    }),
    db.backupRun.count({
      where: {
        success: true,
        startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    db.backupRun.count({
      where: {
        success: false,
        startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    lastSuccess: lastSuccess
      ? {
          startedAt: lastSuccess.startedAt.toISOString(),
          tier: lastSuccess.tier,
          filename: lastSuccess.filename,
          sizeBytes: lastSuccess.sizeBytes ? lastSuccess.sizeBytes.toString() : null,
          durationMs: lastSuccess.durationMs,
        }
      : null,
    lastAttempt: lastAttempt
      ? {
          startedAt: lastAttempt.startedAt.toISOString(),
          success: lastAttempt.success,
          tier: lastAttempt.tier,
          errorMessage: lastAttempt.errorMessage,
          errorCode: lastAttempt.errorCode,
        }
      : null,
    recentRuns: recentRuns.map((r) => ({
      id: r.id,
      startedAt: r.startedAt.toISOString(),
      tier: r.tier,
      filename: r.filename,
      success: r.success,
      sizeBytes: r.sizeBytes ? r.sizeBytes.toString() : null,
      durationMs: r.durationMs,
      errorMessage: r.errorMessage,
    })),
    successCount30d,
    failCount30d,
  };
}

export default async function AdminHealthPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) redirect("/dashboard");
  if (!isSuperUser(session.user.platformRole)) redirect("/admin");

  const data = await getBackupData();

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">System Health</h1>
        <p className="mt-1 text-sm text-slate-500">
          Backup status and infrastructure metrics. All times shown in your local timezone.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Backups
        </h2>
        <BackupHealthCard
          lastSuccess={data.lastSuccess}
          lastAttempt={data.lastAttempt}
          successCount30d={data.successCount30d}
          failCount30d={data.failCount30d}
        />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Recent Backup Runs
        </h2>
        <BackupHistoryTable runs={data.recentRuns} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          System Metrics
        </h2>
        <SystemMetricsCards />
      </section>
    </div>
  );
}
