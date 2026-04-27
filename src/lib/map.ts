import { db } from "@/lib/db";

export async function getCampaignMapPeople(campaignId: string) {
  const [people, campaign] = await Promise.all([
    db.person.findMany({
      where: {
        campaignId,
        deletedAt: null,
        household: {
          address: { lat: { not: null }, lng: { not: null } },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        canvassResponses: {
          orderBy: { respondedAt: "desc" },
          take: 1,
          select: { outcome: true, supportLevel: true },
        },
        household: {
          select: {
            address: {
              select: {
                streetNumber: true,
                streetName: true,
                unitNumber: true,
                lat: true,
                lng: true,
              },
            },
          },
        },
      },
    }),
    db.campaign.findFirst({
      where: { id: campaignId },
      select: { wardBoundary: true },
    }),
  ]);

  const features = people
    .filter((p) => p.household?.address?.lat != null && p.household?.address?.lng != null)
    .map((p) => {
      const addr = p.household!.address!;
      const response = p.canvassResponses[0] ?? null;

      let levelKey: string;
      if (response?.supportLevel) {
        levelKey = response.supportLevel;
      } else if (response?.outcome === "not_home") {
        levelKey = "not_home";
      } else {
        levelKey = "none";
      }

      return {
        personId: p.id,
        name: `${p.firstName} ${p.lastName}`,
        address: `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`,
        lat: addr.lat as number,
        lng: addr.lng as number,
        supportLevel: response?.supportLevel ?? null,
        outcome: response?.outcome ?? null,
        levelKey,
      };
    });

  return {
    features,
    wardBoundary: campaign?.wardBoundary ?? null,
    totalCount: features.length,
  };
}

export type CampaignMapFeature = Awaited<ReturnType<typeof getCampaignMapPeople>>["features"][number];
