import { db } from "../src/lib/db";
import { geocodeAddress } from "../src/lib/geocoding";

async function main() {
  const addresses = await db.address.findMany({
    where: { lat: null },
    select: { id: true, streetNumber: true, streetName: true, city: true, province: true, postalCode: true },
  });

  console.log(`Geocoding ${addresses.length} addresses...`);

  let geocoded = 0;
  let failed = 0;

  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    const result = await geocodeAddress(addr.id);
    if (result) {
      geocoded++;
      console.log(`${i + 1}/${addresses.length} ✓ ${addr.streetNumber} ${addr.streetName}`);
    } else {
      failed++;
      console.log(`${i + 1}/${addresses.length} ✗ ${addr.streetNumber} ${addr.streetName}`);
    }
    // 600ms delay between requests
    if (i < addresses.length - 1) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  console.log(`\nDone. Geocoded: ${geocoded}, Failed: ${failed}`);
  await db.$disconnect();
}

main().catch(console.error);
