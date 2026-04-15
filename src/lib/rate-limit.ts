// In-memory login rate limiter, keyed by IP address.
//
// NOTE: This store lives in the Node.js process heap and resets on every
// server restart. That is acceptable for beta — a determined attacker who
// knows the server restarts can work around it. For production, replace this
// with a Redis-backed store (e.g. Upstash) so limits survive restarts and
// work across multiple server instances.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  windowStart: number;
}

const store = new Map<string, AttemptRecord>();

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remainingAttempts: number;
  resetInMs: number;
} {
  const now = Date.now();
  const record = store.get(ip);

  if (!record || now - record.windowStart >= WINDOW_MS) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, resetInMs: 0 };
  }

  const resetInMs = WINDOW_MS - (now - record.windowStart);

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remainingAttempts: 0, resetInMs };
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - record.count, resetInMs };
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = store.get(ip);

  if (!record || now - record.windowStart >= WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now });
  } else {
    store.set(ip, { count: record.count + 1, windowStart: record.windowStart });
  }
}

export function resetAttempts(ip: string): void {
  store.delete(ip);
}
