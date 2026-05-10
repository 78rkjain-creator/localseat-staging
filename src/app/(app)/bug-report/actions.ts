"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendBugReportEmail } from "@/lib/email";

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB

export async function submitBugReport(
  formData: FormData
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const description = (formData.get("description") as string | null)?.trim();
  if (!description || description.length === 0) {
    return { error: "Please describe the issue." };
  }
  if (description.length > 2000) {
    return { error: "Description is too long." };
  }

  const severity = formData.get("severity") as string | null;
  if (!severity || !["minor", "major", "blocking"].includes(severity)) {
    return { error: "Invalid severity." };
  }

  const currentUrl = (formData.get("currentUrl") as string | null) ?? "Unknown";
  const userAgent = (formData.get("userAgent") as string | null) ?? "Unknown";

  // Screenshot (optional)
  let screenshotBuffer: Buffer | null = null;
  let screenshotName: string | null = null;
  let screenshotType: string | null = null;

  const file = formData.get("screenshot") as File | null;
  if (file && file.size > 0) {
    if (file.size > MAX_SCREENSHOT_SIZE) {
      return { error: "Screenshot must be under 5MB." };
    }
    if (!file.type.startsWith("image/")) {
      return { error: "Screenshot must be an image." };
    }
    screenshotBuffer = Buffer.from(await file.arrayBuffer());
    screenshotName = file.name;
    screenshotType = file.type;
  }

  const { user } = session;

  try {
    await sendBugReportEmail({
      reporterName: `${user.firstName} ${user.lastName}`,
      reporterEmail: user.email,
      role: user.activeRole ?? "Unknown",
      campaignName:
        user.memberships.find((m) => m.campaignId === user.activeCampaignId)
          ?.campaignName ?? "Unknown",
      campaignId: user.activeCampaignId ?? "None",
      severity,
      description,
      currentUrl,
      userAgent,
      timestamp: new Date().toISOString(),
      screenshot: screenshotBuffer
        ? { buffer: screenshotBuffer, name: screenshotName!, type: screenshotType! }
        : null,
    });

    return {};
  } catch (err) {
    console.error("[bug-report] Failed to send bug report:", err);
    return { error: "Failed to send report. Please try again." };
  }
}
