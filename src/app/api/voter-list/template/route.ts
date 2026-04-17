import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const TEMPLATE_HEADERS =
  "FirstName,LastName,StreetNumber,StreetName,UnitNumber,City,Province,PostalCode,PhoneHome,PhoneMobile,Email,BirthYear,PollNumber\r\n";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  return new NextResponse(TEMPLATE_HEADERS, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="voter-list-template.csv"',
    },
  });
}
