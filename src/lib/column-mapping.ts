/**
 * Column-mapping engine for flexible voter/people imports.
 *
 * Instead of requiring a rigid template, this module auto-detects which
 * columns in an uploaded file MIGHT correspond to which internal fields.
 * The user ALWAYS sees a mapping screen to confirm or adjust — we never
 * silently assume a mapping is correct.
 *
 * Coverage: Ontario OVL format, Elections Ontario, Canadian municipal data
 * exports, common CRM exports, free-form spreadsheets from phone books,
 * membership lists, petition sheets, etc.
 */

import type { RowFields } from "./csv-import";

// ── Types ───────────────────────────────────────────────────────────────────

export type MappableField = keyof RowFields;

export interface FieldDef {
  key: MappableField;
  label: string;
  required: boolean;
  /** Aliases checked after normalisation (lowercase, strip spaces/hyphens/underscores/periods). */
  aliases: string[];
}

/** One column from the user's file and its suggested mapping. */
export interface ColumnMapping {
  /** Original header text as it appeared in the file. */
  originalHeader: string;
  /** Suggested internal field, or null if we couldn't guess. */
  suggestedField: MappableField | null;
  /** Confidence: "high" = exact alias match, "medium" = partial match, "none" = no guess. */
  confidence: "high" | "medium" | "none";
  /** What the user has confirmed/chosen. Null until they interact or confirm all. */
  confirmedField: MappableField | "__ignore__" | null;
}

/** The full mapping state for one import session. */
export interface MappingState {
  columns: ColumnMapping[];
  /** Sample rows (raw values) for the preview table. */
  sampleRows: Record<string, string>[];
  /** All original headers from the file. */
  originalHeaders: string[];
}

// ── Field definitions with aliases ──────────────────────────────────────────

export const FIELD_DEFS: FieldDef[] = [
  {
    key: "firstName",
    label: "First name",
    required: true,
    aliases: [
      "firstname", "first", "givenname", "given", "prenom",
      "fname", "forename", "name1",
    ],
  },
  {
    key: "lastName",
    label: "Last name",
    required: true,
    aliases: [
      "lastname", "last", "surname", "familyname", "family",
      "lname", "name2", "nom",
    ],
  },
  {
    key: "streetNumber",
    label: "Street #",
    required: false,
    aliases: [
      "streetnumber", "streetno", "street#", "number", "houseno",
      "housenumber", "house#", "stno", "streetnum", "bldgno",
      "buildingno", "buildingnumber", "civicnumber", "civicno",
    ],
  },
  {
    key: "streetName",
    label: "Street name",
    required: false,
    aliases: [
      "streetname", "street", "streetaddress", "address",
      "addr", "road", "roadname", "st", "stname",
      "address1", "addressline1", "addressline",
    ],
  },
  {
    key: "unitNumber",
    label: "Unit / Apt",
    required: false,
    aliases: [
      "unitnumber", "unit", "unit#", "unitno", "apt", "apartment",
      "suite", "ste", "aptno", "apartmentnumber", "suitenumber",
      "address2", "addressline2",
    ],
  },
  {
    key: "city",
    label: "City",
    required: true,
    aliases: [
      "city", "town", "municipality", "muni", "ville",
      "place", "community", "locale", "citytown",
    ],
  },
  {
    key: "province",
    label: "Province",
    required: true,
    aliases: [
      "province", "prov", "state", "stateprovince", "stateprov",
      "region", "provincestate",
    ],
  },
  {
    key: "postalCode",
    label: "Postal code",
    required: true,
    aliases: [
      "postalcode", "postal", "zip", "zipcode", "postcode",
      "postalzip", "zippostal", "codepostal",
    ],
  },
  {
    key: "phoneHome",
    label: "Phone (home)",
    required: false,
    aliases: [
      "phone", "phonehome", "homephone", "phonenumber", "tel",
      "telephone", "landline", "primaryphone",
    ],
  },
  {
    key: "phoneMobile",
    label: "Phone (mobile)",
    required: false,
    aliases: [
      "mobile", "cell", "cellphone", "mobilephone", "phonemobile",
      "cellular", "cellno", "mobileno", "mobilephone",
    ],
  },
  {
    key: "email",
    label: "Email",
    required: false,
    aliases: [
      "email", "emailaddress", "emailaddr", "mail", "courriel",
      "emailid",
    ],
  },
  {
    key: "birthDate",
    label: "Birth date",
    required: false,
    aliases: [
      "birthdate", "dateofbirth", "dob", "birthday", "bday",
      "datenaissance", "birthyear", "yearofbirth",
    ],
  },
  {
    key: "pollNumber",
    label: "Poll #",
    required: false,
    aliases: [
      "pollnumber", "poll", "pollno", "pollingstation",
      "pollstation", "polldivision", "pd", "pollingdivision",
    ],
  },
  {
    key: "voterId",
    label: "Voter ID",
    required: false,
    aliases: [
      "voterid", "voteridentifier", "electorid", "electoralid",
      "voternumber", "voterno", "electornumber",
    ],
  },
  {
    key: "supportLevel",
    label: "Support level",
    required: false,
    aliases: [
      "supportlevel", "support", "level", "rating", "sentiment",
      "supportrating",
    ],
  },
  {
    key: "tags",
    label: "Tags",
    required: false,
    aliases: [
      "tags", "tag", "taglist", "categories", "category",
      "labels", "label", "groups", "group",
    ],
  },
  {
    key: "notes",
    label: "Notes",
    required: false,
    aliases: [
      "notes", "note", "comment", "comments", "remarks",
      "memo", "description",
    ],
  },
  {
    key: "gender",
    label: "Gender",
    required: false,
    aliases: [
      "gender", "sex", "genderidentity",
    ],
  },
  {
    key: "isConfirmedVoter",
    label: "Confirmed voter",
    required: false,
    aliases: [
      "confirmedvoter", "isconfirmedvoter", "confirmed",
      "verified", "isverified",
    ],
  },
];

// ── Normalisation ───────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[\s_\-.#]/g, "");
}

// ── Auto-suggest logic ──────────────────────────────────────────────────────

/**
 * Given a raw header from the user's file, suggest which field it might be.
 * Returns the field key and confidence level, or null if no match.
 *
 * This is a SUGGESTION — the user must always confirm.
 */
function suggestFieldForHeader(
  rawHeader: string,
  alreadyClaimed: Set<MappableField>,
): { field: MappableField; confidence: "high" | "medium" } | null {
  const norm = normalise(rawHeader);
  if (!norm) return null;

  // Pass 1: exact alias match (high confidence)
  for (const def of FIELD_DEFS) {
    if (alreadyClaimed.has(def.key)) continue;
    if (def.aliases.includes(norm)) {
      return { field: def.key, confidence: "high" };
    }
  }

  // Pass 2: check if normalised header starts with or contains an alias
  // (medium confidence — e.g. "Home Phone Number" contains "homephone")
  for (const def of FIELD_DEFS) {
    if (alreadyClaimed.has(def.key)) continue;
    for (const alias of def.aliases) {
      if (norm.includes(alias) || alias.includes(norm)) {
        return { field: def.key, confidence: "medium" };
      }
    }
  }

  return null;
}

/**
 * Build initial mapping suggestions for all headers in the uploaded file.
 * Each header gets at most one suggestion. Fields are not double-assigned.
 *
 * Returns a MappingState that the UI renders for user confirmation.
 */
export function buildInitialMapping(
  originalHeaders: string[],
  sampleRows: Record<string, string>[],
): MappingState {
  const claimed = new Set<MappableField>();
  const columns: ColumnMapping[] = [];

  // First pass: high-confidence matches
  const suggestions: (ReturnType<typeof suggestFieldForHeader> | null)[] =
    originalHeaders.map(() => null);

  for (let i = 0; i < originalHeaders.length; i++) {
    const result = suggestFieldForHeader(originalHeaders[i], claimed);
    if (result && result.confidence === "high") {
      suggestions[i] = result;
      claimed.add(result.field);
    }
  }

  // Second pass: medium-confidence for unmatched headers
  for (let i = 0; i < originalHeaders.length; i++) {
    if (suggestions[i]) continue;
    const result = suggestFieldForHeader(originalHeaders[i], claimed);
    if (result) {
      suggestions[i] = result;
      claimed.add(result.field);
    }
  }

  // Build column objects
  for (let i = 0; i < originalHeaders.length; i++) {
    const suggestion = suggestions[i];
    columns.push({
      originalHeader: originalHeaders[i],
      suggestedField: suggestion?.field ?? null,
      confidence: suggestion?.confidence ?? "none",
      confirmedField: null, // Always null — user must confirm
    });
  }

  return {
    columns,
    sampleRows: sampleRows.slice(0, 5),
    originalHeaders,
  };
}

// ── Apply confirmed mapping to raw data ─────────────────────────────────────

/**
 * Given confirmed column mappings and raw row data (keyed by original header),
 * produce a normalised Record<string, string> keyed by internal field names
 * that can be passed to buildReviewRow.
 *
 * Custom field mappings (values like "custom:fieldId") are resolved using
 * the customFields list and written under the normalised label key so
 * buildReviewRow can pick them up.
 */
export function applyMapping(
  columns: ColumnMapping[],
  rawRow: Record<string, string>,
  customFields?: { id: string; label: string }[],
): Record<string, string> {
  const mapped: Record<string, string> = {};

  // Build a lookup from custom field id to normalised label
  const cfLabelById = new Map(
    (customFields ?? []).map((cf) => [cf.id, normalise(cf.label)]),
  );

  for (const col of columns) {
    const field = col.confirmedField;
    if (!field || field === "__ignore__") continue;

    const value = rawRow[col.originalHeader] ?? "";

    // Handle custom field mappings ("custom:fieldId" → normalised label key)
    if (field.startsWith("custom:")) {
      const cfId = field.slice(7);
      const normLabel = cfLabelById.get(cfId);
      if (normLabel && value.trim()) {
        mapped[normLabel] = value.trim();
      }
      continue;
    }

    // Standard field — write under normalised field name
    const normKey = normalise(field);
    if (!mapped[normKey] || !mapped[normKey].trim()) {
      mapped[normKey] = value.trim();
    }
  }

  return mapped;
}

/**
 * Get list of required fields that have no column mapped to them.
 */
export function getMissingRequiredMappings(columns: ColumnMapping[]): FieldDef[] {
  const mapped = new Set<MappableField>();
  for (const col of columns) {
    const field = col.confirmedField ?? col.suggestedField;
    if (field && field !== "__ignore__") {
      mapped.add(field as MappableField);
    }
  }
  return FIELD_DEFS.filter((def) => def.required && !mapped.has(def.key));
}

/**
 * Check if a "combined address" column is mapped (streetName mapped but
 * streetNumber is not, or vice versa). This tells the import pipeline to
 * use the address parser.
 */
export function hasAddressColumnMapped(columns: ColumnMapping[]): boolean {
  const confirmed = new Set(
    columns
      .map((c) => c.confirmedField)
      .filter((f): f is MappableField => f !== null && f !== "__ignore__"),
  );
  return confirmed.has("streetName") && !confirmed.has("streetNumber");
}

/**
 * All fields available for the mapping dropdown, plus a "Don't import" option.
 * Optionally includes campaign-defined custom fields.
 */
export function getFieldOptions(
  customFields?: { id: string; label: string }[],
): { value: string; label: string }[] {
  return [
    { value: "__ignore__", label: "Don't import" },
    ...FIELD_DEFS.map((def) => ({
      value: def.key,
      label: `${def.label}${def.required ? " *" : ""}`,
    })),
    ...(customFields ?? []).map((cf) => ({
      value: `custom:${cf.id}`,
      label: `${cf.label} (custom)`,
    })),
  ];
}
