/**
 * Display label for a person's poll number.
 *
 * - Has a value → return it as-is.
 * - No value + ward status unsettled (not_checked | pending_review) → "Pending OVL"
 * - No value + ward status settled → "Unknown"
 *
 * Never use these labels in CSV exports — keep the raw nullable value there.
 */
export function formatPollNumber(
  pollNumber: string | null,
  wardStatus: string
): string {
  if (pollNumber) return pollNumber;
  if (wardStatus === "not_checked" || wardStatus === "pending_review") {
    return "Pending OVL";
  }
  return "Unknown";
}
