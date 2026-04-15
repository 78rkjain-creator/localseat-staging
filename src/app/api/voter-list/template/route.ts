import { NextResponse } from "next/server";

const TEMPLATE_HEADERS =
  "FirstName,LastName,StreetNumber,StreetName,UnitNumber,City,Province,PostalCode,PhoneHome,PhoneMobile,Email,BirthYear\r\n";

export function GET() {
  return new NextResponse(TEMPLATE_HEADERS, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="voter-list-template.csv"',
    },
  });
}
