import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperUser } from "@/lib/permissions";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * System metrics endpoint for the superuser health dashboard.
 *
 * Reads VPS metrics from /proc and shell commands. Returns JSON.
 *
 * Auth: super_user platform role required (session cookie).
 *
 * Note: This route works on Linux only (production VPS). On Vercel/staging,
 * /proc reads and `df`/`pm2` calls will fail. The catch blocks return null
 * for each metric individually so the dashboard can render whatever is
 * available rather than failing outright.
 */
export const dynamic = "force-dynamic";

interface CpuTimes {
  user: number;
  nice: number;
  system: number;
  idle: number;
  iowait: number;
  irq: number;
  softirq: number;
  steal: number;
}

async function readCpuTimes(): Promise<CpuTimes | null> {
  try {
    const stat = await readFile("/proc/stat", "utf8");
    const cpuLine = stat.split("\n").find((l) => l.startsWith("cpu "));
    if (!cpuLine) return null;
    const parts = cpuLine.trim().split(/\s+/).slice(1).map(Number);
    return {
      user: parts[0] || 0,
      nice: parts[1] || 0,
      system: parts[2] || 0,
      idle: parts[3] || 0,
      iowait: parts[4] || 0,
      irq: parts[5] || 0,
      softirq: parts[6] || 0,
      steal: parts[7] || 0,
    };
  } catch {
    return null;
  }
}

async function getCpuUsage(): Promise<number | null> {
  const t1 = await readCpuTimes();
  if (!t1) return null;
  await new Promise((r) => setTimeout(r, 200));
  const t2 = await readCpuTimes();
  if (!t2) return null;

  const idleDelta = t2.idle + t2.iowait - (t1.idle + t1.iowait);
  const totalDelta =
    Object.values(t2).reduce((a, b) => a + b, 0) -
    Object.values(t1).reduce((a, b) => a + b, 0);
  if (totalDelta === 0) return 0;
  return Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100));
}

interface MemInfo {
  totalKb: number;
  availableKb: number;
}

async function getMemInfo(): Promise<MemInfo | null> {
  try {
    const meminfo = await readFile("/proc/meminfo", "utf8");
    const get = (key: string) => {
      const m = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
      return m ? parseInt(m[1], 10) : null;
    };
    const totalKb = get("MemTotal");
    const availableKb = get("MemAvailable");
    if (totalKb === null || availableKb === null) return null;
    return { totalKb, availableKb };
  } catch {
    return null;
  }
}

interface DiskInfo {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
}

async function getDiskInfo(): Promise<DiskInfo | null> {
  try {
    const { stdout } = await execAsync("df -B1 / | tail -1");
    const parts = stdout.trim().split(/\s+/);
    const totalBytes = parseInt(parts[1], 10);
    const usedBytes = parseInt(parts[2], 10);
    const availableBytes = parseInt(parts[3], 10);
    if (isNaN(totalBytes)) return null;
    return { totalBytes, usedBytes, availableBytes };
  } catch {
    return null;
  }
}

interface PmProc {
  name: string;
  pid: number;
  status: string;
  cpuPct: number;
  memBytes: number;
  uptimeMs: number;
  restartCount: number;
}

async function getPmList(): Promise<PmProc[] | null> {
  try {
    const { stdout } = await execAsync("pm2 jlist");
    const arr = JSON.parse(stdout);
    if (!Array.isArray(arr)) return null;
    return arr.map((p: any) => ({
      name: String(p.name ?? "?"),
      pid: Number(p.pid ?? 0),
      status: String(p?.pm2_env?.status ?? "unknown"),
      cpuPct: Number(p?.monit?.cpu ?? 0),
      memBytes: Number(p?.monit?.memory ?? 0),
      uptimeMs:
        Number(p?.pm2_env?.pm_uptime ?? 0) > 0
          ? Date.now() - Number(p.pm2_env.pm_uptime)
          : 0,
      restartCount: Number(p?.pm2_env?.restart_time ?? 0),
    }));
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSuperUser(session.user.platformRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [cpuPct, mem, disk, pmList] = await Promise.all([
    getCpuUsage(),
    getMemInfo(),
    getDiskInfo(),
    getPmList(),
  ]);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    cpu: cpuPct !== null ? { usagePct: Math.round(cpuPct * 10) / 10 } : null,
    memory: mem
      ? {
          totalBytes: mem.totalKb * 1024,
          usedBytes: (mem.totalKb - mem.availableKb) * 1024,
          availableBytes: mem.availableKb * 1024,
          usagePct: Math.round(((mem.totalKb - mem.availableKb) / mem.totalKb) * 1000) / 10,
        }
      : null,
    disk: disk
      ? {
          totalBytes: disk.totalBytes,
          usedBytes: disk.usedBytes,
          availableBytes: disk.availableBytes,
          usagePct: Math.round((disk.usedBytes / disk.totalBytes) * 1000) / 10,
        }
      : null,
    processes: pmList ?? [],
  });
}
