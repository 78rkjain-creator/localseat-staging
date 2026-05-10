import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkOrigin } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_SIZE = 512 * 1024; // 512KB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return NextResponse.json({ error: "No campaign" }, { status: 400 });
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("logo") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File must be PNG, JPEG, WebP, or SVG." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File must be under 512KB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

  await db.campaign.update({
    where: { id: activeCampaignId },
    data: { logoUrl: base64 },
  });

  return NextResponse.json({ ok: true, logoUrl: base64 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return NextResponse.json({ error: "No campaign" }, { status: 400 });
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await db.campaign.update({
    where: { id: activeCampaignId },
    data: { logoUrl: null },
  });

  return NextResponse.json({ ok: true });
}
