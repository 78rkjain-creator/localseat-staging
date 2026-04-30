export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ExcelJS from "exceljs";

const TEAM_HEADERS: Array<{ header: string; key: string; width: number }> = [
  { header: "FirstName",    key: "firstName",    width: 16 },
  { header: "LastName",     key: "lastName",     width: 16 },
  { header: "Email",        key: "email",        width: 26 },
  { header: "Role",         key: "role",         width: 20 },
  { header: "PhoneHome",    key: "phoneHome",    width: 16 },
  { header: "PhoneMobile",  key: "phoneMobile",  width: 16 },
  { header: "StreetNumber", key: "streetNumber", width: 14 },
  { header: "StreetName",   key: "streetName",   width: 22 },
  { header: "UnitNumber",   key: "unitNumber",   width: 12 },
  { header: "City",         key: "city",         width: 16 },
  { header: "Province",     key: "province",     width: 12 },
  { header: "PostalCode",   key: "postalCode",   width: 14 },
  { header: "Tags",         key: "tags",         width: 22 },
];

const ALL_ROLES = [
  "candidate",
  "campaign_manager",
  "co_chair",
  "field_organizer",
  "canvasser",
  "volunteer_coordinator",
  "finance_lead",
  "sign_installer",
  "volunteer",
];

const FO_ROLES = ["canvasser", "sign_installer"];

function colLetter(idx: number): string {
  let letter = "";
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    idx = Math.floor((idx - 1) / 26);
  }
  return letter;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { activeRole } = session.user;
  const allowedRoles =
    activeRole === "field_organizer" ? FO_ROLES : ALL_ROLES;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Team");

  sheet.columns = TEAM_HEADERS;

  // Bold + freeze header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // Row 2: warning row
  const warningRow = sheet.getRow(2);
  warningRow.getCell(1).value =
    "*** DELETE THIS ROW AND THE 4 SAMPLES BELOW BEFORE IMPORTING ***";
  warningRow.font = { color: { argb: "FFCC0000" }, bold: true };

  // Rows 3-5: sample rows
  sheet.addRow([
    "Jane", "Doe", "jane.doe@example.com", "canvasser",
    "", "",
    "123", "Main St", "", "Toronto", "ON", "M5V 2B7", "",
  ]);
  sheet.addRow([
    "John", "Smith", "john.smith@example.com", "field_organizer",
    "613-555-0100", "613-555-0101",
    "", "", "", "", "", "", "",
  ]);
  sheet.addRow([
    "Maria", "Garcia", "maria.garcia@example.com", "sign_installer",
    "", "",
    "55", "Queen St W", "4B", "Toronto", "ON", "M5H 2N2", "early-supporter",
  ]);
  sheet.addRow([
    "Alex", "Chen", "alex.chen@example.com", "volunteer",
    "", "",
    "", "", "", "", "", "", "",
  ]);

  // Role column index (4th column = D)
  const roleColIdx = TEAM_HEADERS.findIndex((h) => h.key === "role") + 1;
  const roleCol = colLetter(roleColIdx);
  const roleFormulae = `"${allowedRoles.join(",")}"`;

  // Pre-touch cell so ExcelJS validation writer has a real cell to anchor to
  sheet.getCell(`${roleCol}7`).value = "";

  for (let row = 7; row <= 1007; row++) {
    sheet.getCell(`${roleCol}${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [roleFormulae],
      showErrorMessage: true,
      errorTitle: "Invalid role",
      error: "Pick a role from the dropdown.",
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="team-import-template.xlsx"',
    },
  });
}
