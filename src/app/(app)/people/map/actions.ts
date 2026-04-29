"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ListSource, WardStatus } from "@prisma/client";
import type { Role } from "@/types";
import { geocodeAndClassifyAddress } from "@/lib/ward";

const CAN_CREATE: Role[] = ["candidate", "campaign_manager", "field_organizer"];

export interface PinDropInput {
  firstName: string;
  lastName: string;
  phoneHome?: string;
  streetNumber: string;
  streetName: string;
  unitNumber?: string;
  city: string;
  province: string;
  postalCode: string;
  lat: number;
  lng: number;
}

export interface PinDropResult {
  personId?: string;
  error?: string;
}

export async function createPinDropContact(input: PinDropInput): Promise<PinDropResult> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !CAN_CREATE.includes(activeRole as Role)) {
    return { error: "You don't have permission to create contacts." };
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const streetNumber = input.streetNumber.trim();
  const streetName = input.streetName.trim();
  const city = input.city.trim();
  const province = input.province.trim() || "ON";
  const postalCode = input.postalCode.trim().replace(/\s/g, "").toUpperCase();

  if (!firstName || !lastName) return { error: "First and last name are required." };
  if (!streetNumber || !streetName || !city) return { error: "Street address is required." };

  try {
    // Reuse an existing address if one matches; otherwise create with pin-drop coordinates.
    let address = postalCode
      ? await db.address.findFirst({
          where: {
            campaignId: activeCampaignId,
            deletedAt: null,
            streetNumber: { equals: streetNumber, mode: "insensitive" },
            streetName: { equals: streetName, mode: "insensitive" },
            unitNumber: input.unitNumber?.trim()
              ? { equals: input.unitNumber.trim(), mode: "insensitive" }
              : null,
            postalCode: { equals: postalCode, mode: "insensitive" },
          },
          select: { id: true, lat: true, lng: true },
        })
      : null;

    if (!address) {
      address = await db.address.create({
        data: {
          campaignId: activeCampaignId,
          streetNumber,
          streetName,
          unitNumber: input.unitNumber?.trim() || null,
          city,
          province,
          postalCode,
          lat: input.lat,
          lng: input.lng,
        },
        select: { id: true, lat: true, lng: true },
      });
    } else if (address.lat === null || address.lng === null) {
      // Backfill coordinates if the existing address didn't have them.
      await db.address.update({
        where: { id: address.id },
        data: { lat: input.lat, lng: input.lng },
      });
    }

    // Reuse an existing household at this address or create one.
    let household = await db.household.findFirst({
      where: { campaignId: activeCampaignId, addressId: address.id, deletedAt: null },
      select: { id: true },
    });
    if (!household) {
      household = await db.household.create({
        data: { campaignId: activeCampaignId, addressId: address.id },
        select: { id: true },
      });
    }

    const person = await db.person.create({
      data: {
        campaignId: activeCampaignId,
        householdId: household.id,
        firstName,
        lastName,
        phoneHome: input.phoneHome?.trim() || null,
        listSource: ListSource.manual,
        wardStatus: WardStatus.not_checked,
        includeInWalkLists: false,
        sourceNotes: "pin-drop",
      },
      select: { id: true },
    });

    // Address already has lat/lng from the pin drop — helper skips Mapbox, runs ward check only
    await geocodeAndClassifyAddress(address.id, activeCampaignId, person.id);

    return { personId: person.id };
  } catch (err) {
    console.error("[pin-drop] create contact error:", err);
    return { error: "Failed to save contact. Try again." };
  }
}
