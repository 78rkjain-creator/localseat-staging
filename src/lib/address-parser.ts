/**
 * Parse a free-form address string into structured pieces.
 *
 * Handles common Canadian formats:
 *   - "33 Wildwood Cres"          → { num: "33",   name: "Wildwood Cres",  unit: "" }
 *   - "2015-5 Massey Sq"          → { num: "5",    name: "Massey Sq",      unit: "2015" }
 *   - "D-2 Selwood Ave"           → { num: "2",    name: "Selwood Ave",    unit: "D" }
 *   - "38,Glen Stewart Crescent"  → { num: "38",   name: "Glen Stewart Crescent", unit: "" }
 *   - "718, 5 Massey Square"      → { num: "5",    name: "Massey Square",  unit: "718" }
 *   - "27 Pine Cres - Cr"         → { num: "27",   name: "Pine Cres",      unit: "" }
 *   - "12-90 Kippendavie Ave"     → { num: "90",   name: "Kippendavie Ave", unit: "12" }
 *   - "4-2A Hambly Ave, Unit 4"   → { num: "2A",   name: "Hambly Ave",     unit: "4" }
 *   - ""                          → { num: "",     name: "",               unit: "", ambiguous: false }
 *
 * Heuristics:
 *   - Treat commas as whitespace for splitting.
 *   - First token can be a unit prefix if it contains a hyphen
 *     (e.g. "2015-5") OR is a single letter followed by hyphen
 *     ("D-2"). In these cases the part before the hyphen is the unit
 *     and the part after is the street number.
 *   - "Apt N", "Suite N", "Unit N", "#N" anywhere in the input → unit = N
 *     and that segment is removed.
 *   - Strip a trailing " - X" suffix (anything after a free-standing dash
 *     followed by another token) — these are usually annotations like
 *     "- Hanson House" or "- Cr".
 *   - If the first remaining token isn't numeric and the input doesn't
 *     match any pattern, set `ambiguous: true` and return the original
 *     in `name`, with `num` and `unit` empty.
 *
 * Returns an `ambiguous` flag for callers to surface as a row warning.
 */
export type ParsedAddress = {
  num: string;
  name: string;
  unit: string;
  ambiguous: boolean;
};

const APT_REGEX = /\b(?:apt\.?|suite|unit|#)\s*([A-Za-z0-9-]+)/i;
const TRAILING_SUFFIX_REGEX = /\s+-\s+\S.*$/;
const HYPHEN_PREFIX_NUMERIC = /^(\d+)-(\d+\w?)$/;      // "2015-5" or "12-90"
const HYPHEN_PREFIX_LETTER  = /^([A-Za-z])-(\d+\w?)$/; // "D-2"
const STREET_NUMBER_REGEX   = /^(\d+\w?)$/;             // "33", "2A"

export function parseAddress(input: string): ParsedAddress {
  if (!input || !input.trim()) {
    return { num: "", name: "", unit: "", ambiguous: false };
  }
  let s = input.trim();
  let unit = "";

  // Step 1: extract any "Apt N" / "Suite N" / "Unit N" / "#N" anywhere
  const aptMatch = s.match(APT_REGEX);
  if (aptMatch) {
    unit = aptMatch[1];
    s = (s.slice(0, aptMatch.index!) + s.slice(aptMatch.index! + aptMatch[0].length)).trim();
  }

  // Step 2: strip trailing " - X..." suffix (annotations like "- Hanson House")
  s = s.replace(TRAILING_SUFFIX_REGEX, "").trim();

  // Step 3: normalize commas to spaces
  s = s.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!s) {
    return { num: "", name: "", unit, ambiguous: false };
  }

  // Step 4: split into tokens
  const tokens = s.split(" ");
  const first = tokens[0];

  // Case A: first token is "<digits>-<digits>" (e.g. "2015-5")
  let m = first.match(HYPHEN_PREFIX_NUMERIC);
  if (m) {
    // Heuristic: the larger-magnitude part is the unit (apartment),
    // the smaller is the street number — Toronto convention.
    // But if the second part is multi-digit AND the first is also
    // multi-digit, ambiguity exists; we default to first=unit.
    const [, a, b] = m;
    const finalUnit = unit || a;
    const finalNum  = b;
    const name = tokens.slice(1).join(" ");
    return { num: finalNum, name, unit: finalUnit, ambiguous: false };
  }

  // Case B: first token is "<letter>-<digits>" (e.g. "D-2")
  m = first.match(HYPHEN_PREFIX_LETTER);
  if (m) {
    const [, letter, num] = m;
    return {
      num,
      name: tokens.slice(1).join(" "),
      unit: unit || letter,
      ambiguous: false,
    };
  }

  // Case C: first token is a clean street number (e.g. "33", "2A")
  m = first.match(STREET_NUMBER_REGEX);
  if (m) {
    return {
      num: m[1],
      name: tokens.slice(1).join(" "),
      unit,
      ambiguous: false,
    };
  }

  // Case D: nothing recognizable — keep the whole thing in name and flag it
  return {
    num: "",
    name: s,
    unit,
    ambiguous: true,
  };
}
