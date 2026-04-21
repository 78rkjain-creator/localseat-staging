import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

async function geocodeAddress(
  id: string,
  streetNumber: string,
  streetName: string,
  city: string,
  province: string,
  postalCode: string
): Promise<{ lat: number; lng: number } | null> {
  if (!TOKEN) { console.error("No Mapbox token"); return null; }
  const query = encodeURIComponent(`${streetNumber} ${streetName}, ${city}, ${province}, ${postalCode}, Canada`);
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${TOKEN}&country=ca&limit=1`);
    if (!res.ok) return null;
    const data = await res.json() as { features?: { center: [number, number] }[] };
    if (!data.features?.length) return null;
    const [lng, lat] = data.features[0].center;
    await db.address.update({ where: { id }, data: { lat, lng } });
    return { lat, lng };
  } catch {
    return null;
  }
}

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
    const result = await geocodeAddress(addr.id, addr.streetNumber, addr.streetName, addr.city, addr.province, addr.postalCode);
    if (result) {
      geocoded++;
      console.log(`${i + 1}/${addresses.length} ✓ ${addr.streetNumber} ${addr.streetName}: ${result.lat},${result.lng}`);
    } else {
      failed++;
      console.log(`${i + 1}/${addresses.length} ✗ ${addr.streetNumber} ${addr.streetName}`);
    }
    if ((i + 1) % 50 === 0) {
      console.log(`--- Progress: ${i + 1}/${addresses.length} (${geocoded} geocoded, ${failed} failed) ---`);
    }
    if (i < addresses.length - 1) await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nDone. Geocoded: ${geocoded}, Failed: ${failed}`);
  await db.$disconnect();
}

main().catch(console.error);
