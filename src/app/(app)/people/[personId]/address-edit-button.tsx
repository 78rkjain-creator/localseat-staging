"use client";

import { useState } from "react";
import { AddressChangeModal } from "@/components/address-change-modal";

interface Address {
  id: string;
  streetNumber: string;
  streetName: string;
  unitNumber: string | null;
  city: string;
  province: string;
  postalCode: string;
}

interface HouseholdMember {
  id: string;
  firstName: string;
  lastName: string;
}

interface AddressEditButtonProps {
  personId: string;
  campaignId: string;
  currentAddress: Address | null;
  householdMembers: HouseholdMember[];
}

export function AddressEditButton({
  personId,
  campaignId,
  currentAddress,
  householdMembers,
}: AddressEditButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-7 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        Edit
      </button>

      {open && (
        <AddressChangeModal
          personId={personId}
          campaignId={campaignId}
          currentAddress={currentAddress}
          householdMembers={householdMembers}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
