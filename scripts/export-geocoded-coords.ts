import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const addresses = await db.address.findMany({
    where: { lat: { not: null } },
    select: {
      streetNumber: true,
      streetName: true,
      lat: true,
      lng: true,
    },
    orderBy: [{ streetName: "asc" }, { streetNumber: "asc" }],
  });

  console.log(`Found ${addresses.length} geocoded addresses`);
  console.log("\nconst GEOCODED_COORDS: Record<string, { lat: number; lng: number }> = {");

  for (const addr of addresses) {
    const key = `${addr.streetNumber} ${addr.streetName}`;
    console.log(`  "${key}": { lat: ${addr.lat}, lng: ${addr.lng} },`);
  }

  console.log("}");

  await db.$disconnect();
}

main().catch(console.error);
