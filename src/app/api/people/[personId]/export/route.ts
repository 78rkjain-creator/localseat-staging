import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return NextResponse.json({ error: "No campaign" }, { status: 400 });
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { personId } = await params;

  const person = await db.person.findFirst({
    where: { id: personId, campaignId: activeCampaignId, deletedAt: null },
    include: {
      household: {
        include: { address: true },
      },
      tags: { include: { tag: { select: { name: true } } }, where: { deletedAt: null } },
      notes: {
        where: { deletedAt: null },
        include: { author: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      },
      canvassResponses: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          supportLevel: true,
          signRequested: true,
          volunteerInterest: true,
          donorInterest: true,
          notHome: true,
          moved: true,
          deceased: true,
          refused: true,
          notes: true,
          createdAt: true,
        },
      },
      outreachLogs: {
        orderBy: { contactDate: "desc" },
        select: {
          id: true,
          contactType: true,
          contactDate: true,
          outcome: true,
          notes: true,
        },
      },
      linkedDonors: {
        select: {
          id: true,
          status: true,
          amount: true,
          pledgeDate: true,
          receivedDate: true,
          notes: true,
        },
      },
      surveyResponses: {
        include: {
          survey: { select: { name: true } },
        },
        select: {
          id: true,
          surveyId: true,
          answers: true,
          createdAt: true,
          survey: { select: { name: true } },
        },
      },
      tasks: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          createdAt: true,
        },
      },
    },
  });

  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  // Build CSV sections
  const lines: string[] = [];

  // Personal information
  lines.push("=== PERSONAL INFORMATION ===");
  lines.push("Field,Value");
  lines.push(`First Name,"${esc(person.firstName)}"`);
  lines.push(`Last Name,"${esc(person.lastName)}"`);
  lines.push(`Phone (Home),"${esc(person.phoneHome)}"`);
  lines.push(`Phone (Mobile),"${esc(person.phoneMobile)}"`);
  lines.push(`Email,"${esc(person.email)}"`);
  lines.push(`Date of Birth,"${person.birthDate ? person.birthDate.toISOString().split("T")[0] : ""}"`);
  lines.push(`Gender,"${esc(person.gender)}"`);
  lines.push(`Support Level,"${esc(person.supportLevel)}"`);
  lines.push(`Do Not Contact,"${person.doNotContact ? "Yes" : "No"}"`);
  lines.push(`Record Created,"${person.createdAt.toISOString()}"`);
  if (person.anonymizedAt) {
    lines.push(`Anonymized At,"${person.anonymizedAt.toISOString()}"`);
  }

  // Address
  const addr = person.household?.address;
  if (addr) {
    lines.push("");
    lines.push("=== ADDRESS ===");
    lines.push("Field,Value");
    lines.push(`Street Number,"${esc(addr.streetNumber)}"`);
    lines.push(`Street Name,"${esc(addr.streetName)}"`);
    lines.push(`Unit Number,"${esc(addr.unitNumber)}"`);
    lines.push(`City,"${esc(addr.city)}"`);
    lines.push(`Province,"${esc(addr.province)}"`);
    lines.push(`Postal Code,"${esc(addr.postalCode)}"`);
  }

  // Tags
  if (person.tags.length > 0) {
    lines.push("");
    lines.push("=== TAGS ===");
    lines.push(`Tags,"${person.tags.map((t) => t.tag.name).join(", ")}"`);
  }

  // Notes
  if (person.notes.length > 0) {
    lines.push("");
    lines.push("=== NOTES ===");
    lines.push("Date,Author,Note");
    for (const n of person.notes) {
      lines.push(
        `"${n.createdAt.toISOString().split("T")[0]}","${n.author.firstName} ${n.author.lastName}","${esc(n.body)}"`
      );
    }
  }

  // Canvass responses
  if (person.canvassResponses.length > 0) {
    lines.push("");
    lines.push("=== CANVASS RESPONSES ===");
    lines.push("Date,Support Level,Sign Requested,Volunteer Interest,Donor Interest,Not Home,Notes");
    for (const r of person.canvassResponses) {
      lines.push(
        `"${r.createdAt.toISOString().split("T")[0]}","${esc(r.supportLevel)}","${r.signRequested ? "Yes" : "No"}","${r.volunteerInterest ? "Yes" : "No"}","${r.donorInterest ? "Yes" : "No"}","${r.notHome ? "Yes" : "No"}","${esc(r.notes)}"`
      );
    }
  }

  // Outreach logs
  if (person.outreachLogs.length > 0) {
    lines.push("");
    lines.push("=== OUTREACH LOGS ===");
    lines.push("Date,Type,Outcome,Notes");
    for (const o of person.outreachLogs) {
      lines.push(
        `"${o.contactDate.toISOString().split("T")[0]}","${esc(o.contactType)}","${esc(o.outcome)}","${esc(o.notes)}"`
      );
    }
  }

  // Donor records
  if (person.linkedDonors.length > 0) {
    lines.push("");
    lines.push("=== DONOR RECORDS ===");
    lines.push("Status,Amount,Pledge Date,Received Date,Notes");
    for (const d of person.linkedDonors) {
      lines.push(
        `"${esc(d.status)}","${d.amount ?? ""}","${d.pledgeDate ? d.pledgeDate.toISOString().split("T")[0] : ""}","${d.receivedDate ? d.receivedDate.toISOString().split("T")[0] : ""}","${esc(d.notes)}"`
      );
    }
  }

  // Survey responses
  if (person.surveyResponses.length > 0) {
    lines.push("");
    lines.push("=== SURVEY RESPONSES ===");
    lines.push("Date,Survey,Answers");
    for (const s of person.surveyResponses) {
      const answersStr = typeof s.answers === "object" ? JSON.stringify(s.answers) : String(s.answers ?? "");
      lines.push(
        `"${s.createdAt.toISOString().split("T")[0]}","${esc(s.survey.name)}","${esc(answersStr)}"`
      );
    }
  }

  // Tasks
  if (person.tasks.length > 0) {
    lines.push("");
    lines.push("=== FOLLOW-UP TASKS ===");
    lines.push("Title,Status,Due Date,Created");
    for (const t of person.tasks) {
      lines.push(
        `"${esc(t.title)}","${esc(t.status)}","${t.dueDate ? t.dueDate.toISOString().split("T")[0] : ""}","${t.createdAt.toISOString().split("T")[0]}"`
      );
    }
  }

  // NOTE: Voting history intentionally excluded per product requirement

  const csv = lines.join("\n");
  const filename = `person-data-${person.firstName}-${person.lastName}-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function esc(val: string | null | undefined): string {
  if (val === null || val === undefined) return "";
  return val.replace(/"/g, '""');
}
