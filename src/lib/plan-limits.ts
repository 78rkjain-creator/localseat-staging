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
  followUpQueueEnabled:  boolean;
  analyticsEnabled:      boolean;
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
    followUpQueueEnabled:  false,
    analyticsEnabled:      false,
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
    followUpQueueEnabled:  true,
    analyticsEnabled:      true,
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
    followUpQueueEnabled:  true,
    analyticsEnabled:      true,
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
  followUpQueueEnabled:  true,
  analyticsEnabled:      true,
  isUnlimited:           () => true,
};

// ── Settings parser ────────────────────────────────────────────────────────────

function parseSettings(
  tier: Exclude<PlanTier, "demo">,
  settings: Map<string, string>,
): TierLimits {
  const fb = FALLBACKS[tier];

  function num(key: string, fallback: number): number {
    const raw = settings.get(`${tier}_${key}`);
    if (raw === undefined) {
      console.warn(`[plan-limits] Missing PlatformSettings key "${tier}_${key}", using fallback ${fallback}`);
      return fallback;
    }
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  function feat(key: string, fallback: boolean): boolean {
    const raw = settings.get(`${tier}_feature_${key}`);
    if (raw === undefined) return fallback;
    return raw === "true";
  }

  return {
    constituentLimit:      num("constituent_limit",      fb.constituentLimit),
    canvasserLimit:        num("canvasser_limit",         fb.canvasserLimit),
    campaignManagerLimit:  num("campaign_manager_limit",  fb.campaignManagerLimit),
    coChairLimit:          num("cochair_limit",           fb.coChairLimit),
    fieldOrganizerLimit:   num("field_organizer_limit",   fb.fieldOrganizerLimit),
    donorTrackingEnabled:  feat("donor_tracking",         fb.donorTrackingEnabled),
    volunteerCoordEnabled: feat("volunteer_coordination", fb.volunteerCoordEnabled),
    financeLeadEnabled:    feat("finance_lead_access",    fb.financeLeadEnabled),
    followUpQueueEnabled:  feat("follow_up_queue",        fb.followUpQueueEnabled),
    analyticsEnabled:      feat("analytics",              fb.analyticsEnabled),
  };
}

// ── "Best of" helpers ──────────────────────────────────────────────────────────
// Snapshot protects campaigns from having limits reduced after they sign up.

function bestNumeric(snapshot: number | null | undefined, current: number): number {
  if (snapshot === null || snapshot === undefined) return current;
  if (snapshot === 0 || current === 0) return 0; // unlimited wins
  return Math.max(snapshot, current);             // more generous wins
}

function bestBoolean(snapshot: boolean | null | undefined, current: boolean): boolean {
  if (snapshot === null || snapshot === undefined) return current;
  return snapshot || current; // enabled if either is true
}

// ── Main resolver ──────────────────────────────────────────────────────────────

export async function getEffectiveLimits(campaignId: string): Promise<EffectiveLimits> {
  // 1. Load campaign plan + override (snapshot fields included)
  const [campaign, override] = await Promise.all([
    db.campaign.findUnique({
      where:  { id: campaignId },
      select: { plan: true, planActivated: true },
    }),
    db.campaignOverride.findUnique({ where: { campaignId } }),
  ]);

  // 2. Demo plan or inactive → fully unlimited
  if (!campaign || campaign.plan === "demo" || !campaign.planActivated) {
    return UNLIMITED;
  }

  const tier = campaign.plan as Exclude<PlanTier, "demo">;

  // 3. Load all PlatformSettings
  const rows = await db.platformSettings.findMany();
  const settings = new Map(rows.map((r) => [r.key, r.value]));

  // 4. Build current tier defaults from settings (with fallback)
  const tierLimits = parseSettings(tier, settings);

  // 5. Merge: priority chain is
  //    manual override (explicit) → best(snapshot, current default) → hardcoded fallback
  function resolveNum(
    manualOverride: number | null | undefined,
    snapshot: number | null | undefined,
    current: number,
  ): number {
    if (manualOverride !== null && manualOverride !== undefined) return manualOverride;
    return bestNumeric(snapshot, current);
  }

  function resolveBool(
    manualOverride: boolean | null | undefined,
    snapshot: boolean | null | undefined,
    current: boolean,
  ): boolean {
    if (manualOverride !== null && manualOverride !== undefined) return manualOverride;
    return bestBoolean(snapshot, current);
  }

  const merged: TierLimits = {
    constituentLimit:      resolveNum(override?.constituentLimit,     override?.snapshotConstituentLimit,    tierLimits.constituentLimit),
    canvasserLimit:        resolveNum(override?.canvasserLimit,       override?.snapshotCanvasserLimit,      tierLimits.canvasserLimit),
    campaignManagerLimit:  resolveNum(null,                           override?.snapshotCampaignManagerLimit, tierLimits.campaignManagerLimit),
    coChairLimit:          resolveNum(override?.coChairLimit,         override?.snapshotCoChairLimit,        tierLimits.coChairLimit),
    fieldOrganizerLimit:   resolveNum(override?.fieldOrganizerLimit,  override?.snapshotFieldOrganizerLimit, tierLimits.fieldOrganizerLimit),
    donorTrackingEnabled:  resolveBool(override?.donorTrackingEnabled, override?.snapshotDonorTracking,     tierLimits.donorTrackingEnabled),
    volunteerCoordEnabled: resolveBool(null,                           override?.snapshotVolunteerCoord,     tierLimits.volunteerCoordEnabled),
    financeLeadEnabled:    resolveBool(null,                           override?.snapshotFinanceLeadAccess,  tierLimits.financeLeadEnabled),
    followUpQueueEnabled:  resolveBool(override?.followUpQueueEnabled, override?.snapshotFollowUpQueue,     tierLimits.followUpQueueEnabled),
    analyticsEnabled:      resolveBool(override?.analyticsEnabled,     override?.snapshotAnalytics,         tierLimits.analyticsEnabled),
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

export async function isFollowUpQueueEnabled(campaignId: string): Promise<boolean> {
  const limits = await getEffectiveLimits(campaignId);
  return limits.followUpQueueEnabled;
}

export async function isAnalyticsEnabled(campaignId: string): Promise<boolean> {
  const limits = await getEffectiveLimits(campaignId);
  return limits.analyticsEnabled;
}
