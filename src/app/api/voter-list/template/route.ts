export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import ExcelJS from "exceljs";


const BASE_HEADERS: Array<{ header: string; key: string; width: number }> = [
  { header: "FirstName",      key: "firstName",      width: 18 },
  { header: "LastName",       key: "lastName",       width: 18 },
  { header: "StreetNumber",   key: "streetNumber",   width: 14 },
  { header: "StreetName",     key: "streetName",     width: 22 },
  { header: "UnitNumber",     key: "unitNumber",     width: 12 },
  { header: "City",           key: "city",           width: 18 },
  { header: "Province",       key: "province",       width: 12 },
  { header: "PostalCode",     key: "postalCode",     width: 14 },
  { header: "PhoneHome",      key: "phoneHome",      width: 16 },
  { header: "PhoneMobile",    key: "phoneMobile",    width: 16 },
  { header: "Email",          key: "email",          width: 24 },
  { header: "BirthDate",      key: "birthDate",      width: 14 },
  { header: "PollNumber",     key: "pollNumber",     width: 12 },
  { header: "VoterId",        key: "voterId",        width: 18 },
  { header: "SupportLevel",   key: "supportLevel",   width: 16 },
  { header: "Tags",           key: "tags",           width: 22 },
  { header: "Gender",         key: "gender",         width: 12 },
  { header: "Notes",          key: "notes",          width: 30 },
  { header: "ConfirmedVoter", key: "confirmedVoter", width: 16 },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { activeCampaignId } = session.user;

  type CampaignCustomField = { id: string; label: string };
  let customFields: CampaignCustomField[] = [];
  if (activeCampaignId) {
    const campaign = await db.campaign.findUnique({
      where: { id: activeCampaignId },
      select: { customFields: true },
    });
    customFields = (campaign?.customFields as CampaignCustomField[] | null) ?? [];
  }

  const workbook = new ExcelJS.Workbook();

  // ── Main voter sheet ─────────────────────────────────────────────────────
  const sheet = workbook.addWorksheet("Voters");

  const allColumns = [
    ...BASE_HEADERS,
    ...customFields.map((f) => ({ header: f.label, key: `cf_${f.id}`, width: 20 })),
  ];

  sheet.columns = allColumns;

  // Bold + freeze header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // ── Data validations ─────────────────────────────────────────────────────

  const supportLevelColIdx = allColumns.findIndex((c) => c.key === "supportLevel") + 1;
  const confirmedVoterColIdx = allColumns.findIndex((c) => c.key === "confirmedVoter") + 1;

  function colLetter(idx: number): string {
    let letter = "";
    while (idx > 0) {
      const rem = (idx - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      idx = Math.floor((idx - 1) / 26);
    }
    return letter;
  }

  const supportLevelCol = colLetter(supportLevelColIdx);
  const confirmedVoterCol = colLetter(confirmedVoterColIdx);

  // Pre-touch so ExcelJS's validation writer has real cell objects to anchor to
  sheet.getCell(`${supportLevelCol}2`).value = "";
  sheet.getCell(`${confirmedVoterCol}2`).value = "";

  for (let row = 2; row <= 1001; row++) {
    sheet.getCell(`${supportLevelCol}${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"strong_yes,soft_yes,undecided,soft_no,strong_no,not_home"'],
      showErrorMessage: true,
      errorTitle: "Invalid support level",
      error: "Pick a value from the dropdown or leave blank.",
    };
    sheet.getCell(`${confirmedVoterCol}${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"true,false"'],
    };
  }

  // ── Write buffer and return ──────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="voter-list-template.xlsx"',
    },
  });
}
