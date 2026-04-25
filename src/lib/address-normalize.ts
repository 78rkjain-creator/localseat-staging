/**
 * Address normalisation utilities for OVL matching.
 * Normalises to full-word form so both sides of any comparison
 * reduce to the same string regardless of which abbreviation was used.
 */

// [full, abbreviation] — abbr is matched as a whole word and expanded to full
const STREET_TYPE_ABBREVS: [string, string][] = [
  ["street",    "st"],
  ["avenue",    "ave"],
  ["boulevard", "blvd"],
  ["drive",     "dr"],
  ["road",      "rd"],
  ["court",     "crt"],
  ["court",     "ct"],
  ["crescent",  "cres"],
  ["lane",      "ln"],
  ["place",     "pl"],
];

const DIRECTIONAL_ABBREVS: [string, string][] = [
  ["north", "n"],
  ["south", "s"],
  ["east",  "e"],
  ["west",  "w"],
];

// Pre-compiled regex pairs for performance
const STREET_TYPE_PATTERNS = STREET_TYPE_ABBREVS.map(([full, abbr]) => ({
  full,
  re: new RegExp(`\\b${abbr}\\b`, "g"),
}));

const DIRECTIONAL_PATTERNS = DIRECTIONAL_ABBREVS.map(([full, abbr]) => ({
  full,
  re: new RegExp(`\\b${abbr}\\b`, "g"),
}));

// Unit/suite patterns to strip before comparison
const UNIT_STRIP_RE = /\s+(unit|apt|suite)\s*#?\s*\d+\w*|\s+#\s*\d+\w*/gi;

export function normalizeStreet(street: string): string {
  let s = street.toLowerCase().trim();

  // 1. Strip periods
  s = s.replace(/\./g, "");

  // 2. Strip unit / apt / suite / # suffixes
  s = s.replace(UNIT_STRIP_RE, "");

  // 3. Expand street-type abbreviations to full form
  for (const { full, re } of STREET_TYPE_PATTERNS) {
    s = s.replace(re, full);
  }

  // 4. Expand directional abbreviations to full form
  for (const { full, re } of DIRECTIONAL_PATTERNS) {
    s = s.replace(re, full);
  }

  // 5. Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

export function normalizeFullAddress(street: string, city: string): string {
  return `${normalizeStreet(street)} ${city.toLowerCase().trim()}`;
}
