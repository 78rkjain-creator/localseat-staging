export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const TEMPLATE_CSV = [
  "firstName,lastName,streetNumber,streetName,city,electionType,electionYear,electionName,participated,partySupport,notes",
  "Jane,Smith,123,Main St,Toronto,municipal,2022,Toronto City Council,yes,Liberal,",
  "John,Doe,456,Queen Ave,Toronto,provincial,2022,Ontario General Election,yes,NDP,",
  "Maria,Garcia,789,King Blvd,Toronto,federal,2021,44th Canadian General Election,no,,Did not vote",
].join("\r\n");

export async function GET() {
  return new NextResponse(TEMPLATE_CSV, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="voting-history-template.csv"',
    },
  });
}
