// Input sanitization utilities for server actions.
// These functions normalize and validate user-supplied values before
// they reach the database. They never throw — invalid input returns null.

// ── Text ──────────────────────────────────────────────────────────────────────

/**
 * Trims whitespace, enforces a max length, and returns null if empty.
 * Default maxLength is 500; pass a smaller value for name fields (e.g. 100).
 */
export function sanitizeText(
  value: string | null | undefined,
  maxLength = 500
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

// ── Email ─────────────────────────────────────────────────────────────────────

/**
 * Trims, lowercases, and validates basic email format (must contain @ with a
 * dot somewhere after it). Returns null if empty or structurally invalid.
 */
export function sanitizeEmail(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const atIndex = trimmed.indexOf("@");
  if (atIndex < 1) return null;
  const domain = trimmed.slice(atIndex + 1);
  if (!domain.includes(".")) return null;
  return trimmed;
}

// ── Phone ─────────────────────────────────────────────────────────────────────

/**
 * Strips all characters except digits and the leading + sign, then returns
 * null if fewer than 7 digits remain (too short to be a real number).
 */
export function sanitizePhone(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/[^0-9+]/g, "");
  if (!stripped) return null;
  const digits = stripped.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return stripped;
}

// ── Birth date ────────────────────────────────────────────────────────────────

/**
 * Parses a birth date from a string (YYYY-MM-DD) or Date object.
 * Validates that the year is in the range 1900–current year.
 * Returns null for empty, invalid, or out-of-range values.
 */
export function sanitizeBirthDate(
  value: string | Date | null | undefined
): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value as string);
  if (isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  if (year < 1900 || year > new Date().getFullYear()) return null;
  return date;
}

// ── Amount ────────────────────────────────────────────────────────────────────

/**
 * Parses to float, returns null for NaN or negative values.
 * Zero is allowed (a $0 record is valid for tracking purposes).
 */
export function sanitizeAmount(
  value: number | string | null | undefined
): number | null {
  if (value == null || value === "") return null;
  const parsed = parseFloat(String(value));
  if (isNaN(parsed)) return null;
  if (parsed < 0) return null;
  return parsed;
}

// ── Date ──────────────────────────────────────────────────────────────────────

/**
 * Parses a date string with new Date(). Returns null for empty input or
 * any value that produces an Invalid Date.
 */
export function sanitizeDate(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date;
}

// ── Integer ───────────────────────────────────────────────────────────────────

/**
 * Parses to integer, returns null for NaN or values outside the optional
 * min/max range (inclusive).
 */
export function sanitizeInteger(
  value: number | string | null | undefined,
  min?: number,
  max?: number
): number | null {
  if (value == null || value === "") return null;
  const parsed = parseInt(String(value), 10);
  if (isNaN(parsed)) return null;
  if (min !== undefined && parsed < min) return null;
  if (max !== undefined && parsed > max) return null;
  return parsed;
}

// ── Enum ──────────────────────────────────────────────────────────────────────

/**
 * Returns the value cast to T if it exists in the allowed list, otherwise null.
 * Provides a runtime guard for TypeScript enum/union fields.
 */
export function sanitizeEnum<T extends string>(
  value: unknown,
  allowed: T[]
): T | null {
  if (typeof value !== "string") return null;
  return allowed.includes(value as T) ? (value as T) : null;
}
