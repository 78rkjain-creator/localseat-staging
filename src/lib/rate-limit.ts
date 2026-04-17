// WARNING: This rate limiter uses in-memory storage.
// It resets on every server restart and does not work correctly
// across multiple server instances (e.g. Vercel, Railway with replicas).
// Before scaling to multiple instances, replace with a Redis-backed
// implementation using ioredis or Upstash.
//
// Keying by email rather than IP means a single account cannot be
// brute-forced from multiple IPs, and legitimate users on shared IPs
// (e.g. a campaign office) are not blocked by a colleague's failed attempts.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  windowStart: number;
}

const store = new Map<string, AttemptRecord>();

/** Normalise the key so casing differences don't create separate buckets. */
function normaliseKey(email: string): string {
  return email.toLowerCase().trim();
}

export function checkRateLimit(email: string): {
  allowed: boolean;
  remainingAttempts: number;
  resetInMs: number;
} {
  const key = normaliseKey(email);
  const now = Date.now();
  const record = store.get(key);

  if (!record || now - record.windowStart >= WINDOW_MS) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, resetInMs: 0 };
  }

  const resetInMs = WINDOW_MS - (now - record.windowStart);

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remainingAttempts: 0, resetInMs };
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - record.count, resetInMs };
}

export function recordFailedAttempt(email: string): void {
  const key = normaliseKey(email);
  const now = Date.now();
  const record = store.get(key);

  if (!record || now - record.windowStart >= WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
  } else {
    store.set(key, { count: record.count + 1, windowStart: record.windowStart });
  }
}

export function resetAttempts(email: string): void {
  store.delete(normaliseKey(email));
}
