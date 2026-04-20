import { db } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PlanTier = "starter" | "campaign" | "election" | "demo";

export type TierLimits = {
  constituentLimit:      number;  // 0 = unlimited
  canvasserLimit:        number;  // 0 = unlimited
  campaignManagerLimit:  number;
  coChairLimit:          number;
  fieldOrganizerLimit:   number;
  donorTrackingEnabled:  boolean;
  volunteerCoordEnabled: boolean;
  financeLeadEnabled:    boolean;
};

export type EffectiveLimits = TierLimits & {
  isUnlimited: (field: keyof TierLimits) => boolean;
};

// ── Hardcoded fallbacks ────────────────────────────────────────────────────────
// Used when PlatformSettings rows are missing from the DB.

const FALLBACKS: Record<Exclude<PlanTier, "demo">, TierLimits> = {
  starter: {
    constituentLimit:      2500,
    canvasserLimit:        3,
    campaignManagerLimit:  1,
    coChairLimit:          0,
    fieldOrganizerLimit:   1,
    donorTrackingEnabled:  false,
    volunteerCoordEnabled: false,
    financeLeadEnabled:    false,
  },
  campaign: {
    constituentLimit:      15000,
    canvasserLimit:        0,
    campaignManagerLimit:  0,
    coChairLimit:          2,
    fieldOrganizerLimit:   0,
    donorTrackingEnabled:  true,
    volunteerCoordEnabled: true,
    financeLeadEnabled:    true,
  },
  election: {
    constituentLimit:      0,
    canvasserLimit:        0,
    campaignManagerLimit:  0,
    coChairLimit:          0,
    fieldOrganizerLimit:   0,
    donorTrackingEnabled:  true,
    volunteerCoordEnabled: true,
    financeLeadEnabled:    true,
  },
};

const UNLIMITED: EffectiveLimits = {
  constituentLimit:      0,
  canvasserLimit:        0,
  campaignManagerLimit:  0,
  coChairLimit:          0,
  fieldOrganizerLimit:   0,
  donorTrackingEnabled:  true,
  volunteerCoordEnabled: true,
  financeLeadEnabled:    true,
  isUnlimited:           () => true,
};

// ── Settings parser ────────────────────────────────────────────────────────────

function parseSettings(
  tier: Exclude<PlanTier, "demo">,
  settings: Map<string, string>,
): TierLimits {
  function num(key: string, fallback: number): number {
    const raw = settings.get(`${tier}_${key}`);
    if (raw === undefined) {
      console.warn(`[plan-limits] Missing PlatformSettings key "${tier}_${key}", using fallback ${fallback}`);
      return fallback;
    }
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  const fb = FALLBACKS[tier];

  return {
    constituentLimit:      num("constituent_limit",      fb.constituentLimit),
    canvasserLimit:        num("canvasser_limit",         fb.canvasserLimit),
    campaignManagerLimit:  num("campaign_manager_limit",  fb.campaignManagerLimit),
    coChairLimit:          num("cochair_limit",           fb.coChairLimit),
    fieldOrganizerLimit:   num("field_organizer_limit",   fb.fieldOrganizerLimit),
    // Feature flags derived from limits: 0 canvasserLimit means features are on
    // Donor/volunteer/finance features enabled on campaign and above
    donorTrackingEnabled:  tier !== "starter",
    volunteerCoordEnabled: tier !== "starter",
    financeLeadEnabled:    tier !== "starter",
  };
}

// ── Main resolver ──────────────────────────────────────────────────────────────

export async function getEffectiveLimits(campaignId: string): Promise<EffectiveLimits> {
  // 1. Load campaign plan
  const campaign = await db.campaign.findUnique({
    where:  { id: campaignId },
    select: { plan: true, planActivated: true },
  });

  // 2. Demo plan or inactive (not yet paid / still in setup) → fully unlimited
  if (!campaign || campaign.plan === "demo" || !campaign.planActivated) {
    return UNLIMITED;
  }

  const tier = campaign.plan as Exclude<PlanTier, "demo">;

  // 3. Load all PlatformSettings
  const rows = await db.platformSettings.findMany();
  const settings = new Map(rows.map((r) => [r.key, r.value]));

  // 4. Build tier defaults from settings (with fallback)
  const tierLimits = parseSettings(tier, settings);

  // 5. Load per-campaign override
  const override = await db.campaignOverride.findUnique({
    where: { campaignId },
  });

  // 6. Merge: override values take precedence (only when explicitly set)
  const merged: TierLimits = {
    constituentLimit:      override?.constituentLimit      ?? tierLimits.constituentLimit,
    canvasserLimit:        override?.canvasserLimit        ?? tierLimits.canvasserLimit,
    campaignManagerLimit:  tierLimits.campaignManagerLimit, // no override field for this
    coChairLimit:          override?.coChairLimit          ?? tierLimits.coChairLimit,
    fieldOrganizerLimit:   override?.fieldOrganizerLimit   ?? tierLimits.fieldOrganizerLimit,
    donorTrackingEnabled:  override?.donorTrackingEnabled  ?? tierLimits.donorTrackingEnabled,
    volunteerCoordEnabled: tierLimits.volunteerCoordEnabled,
    financeLeadEnabled:    tierLimits.financeLeadEnabled,
  };

  return {
    ...merged,
    isUnlimited: (field) => {
      const val = merged[field];
      return typeof val === "number" ? val === 0 : false;
    },
  };
}

// ── Helper functions ───────────────────────────────────────────────────────────

export async function canAddConstituent(
  campaignId: string,
  currentCount: number,
): Promise<boolean> {
  const limits = await getEffectiveLimits(campaignId);
  return limits.isUnlimited("constituentLimit") || currentCount < limits.constituentLimit;
}

export async function canAddCanvasser(
  campaignId: string,
  currentCount: number,
): Promise<boolean> {
  const limits = await getEffectiveLimits(campaignId);
  return limits.isUnlimited("canvasserLimit") || currentCount < limits.canvasserLimit;
}

export async function canAddRole(
  campaignId: string,
  role: string,
  currentCount: number,
): Promise<boolean> {
  const limits = await getEffectiveLimits(campaignId);

  switch (role) {
    case "canvasser":
      return limits.isUnlimited("canvasserLimit") || currentCount < limits.canvasserLimit;
    case "campaign_manager":
      return limits.isUnlimited("campaignManagerLimit") || currentCount < limits.campaignManagerLimit;
    case "co_chair":
      return limits.isUnlimited("coChairLimit") || currentCount < limits.coChairLimit;
    case "field_organizer":
      return limits.isUnlimited("fieldOrganizerLimit") || currentCount < limits.fieldOrganizerLimit;
    // candidate, volunteer_coordinator, finance_lead have no numeric seat limit
    default:
      return true;
  }
}

export async function isDonorTrackingEnabled(campaignId: string): Promise<boolean> {
  const limits = await getEffectiveLimits(campaignId);
  return limits.donorTrackingEnabled;
}

export async function isVolunteerCoordEnabled(campaignId: string): Promise<boolean> {
  const limits = await getEffectiveLimits(campaignId);
  return limits.volunteerCoordEnabled;
}
