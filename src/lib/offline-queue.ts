/**
 * offline-queue.ts — IndexedDB queue for canvass responses captured while offline.
 *
 * OFFLINE STRATEGY:
 * When the device has no network connection, canvass responses are written to
 * IndexedDB instead of being sent to the server. When connectivity is restored,
 * the useOfflineSync hook reads this queue and flushes items in order by calling
 * the saveCanvassResponse server action.
 *
 * RETRY AND PARK:
 * Each item tracks lifetime retry state in IndexedDB (persists across page reloads).
 * After MAX_RETRIES failures the item transitions to status="parked" and stops
 * blocking other items. Parked items remain visible in the UI so the canvasser
 * can retry manually or discard them.
 *
 * CURRENT LIMITATIONS:
 * - Queue is per-browser, per-device. Items on device A are invisible to device B.
 * - Items are stored unencrypted in the browser's local storage. This matches the
 *   security posture of the rest of the app — the canvasser is already authenticated.
 * - Concurrent browser tabs could attempt to sync the same queue simultaneously.
 *   In V1, the canvassing workflow is single-tab only so this is acceptable.
 * - Queued items include a local queuedAt timestamp. The server action applies its
 *   own server-side timestamp on the respondedAt field when queuedAt falls outside
 *   the 48-hour acceptance window.
 */

import type { SupportLevel, CanvassOutcome } from "@/types";

const DB_NAME = "localseat_offline";
const STORE_NAME = "canvass_queue";
const DB_VERSION = 2;

export interface QueuedResponse {
  /** Local UUID assigned at enqueue time. */
  id: string;
  assignmentId: string;
  personId: string;
  outcome: CanvassOutcome;
  supportLevel: SupportLevel | null;
  wantsSign: boolean;
  isVolunteer: boolean;
  isDonorInterest: boolean;
  needsFollowUp: boolean;
  notes: string;
  competitorId: string | null;
  /** For support level 3 sub-options: wont_say | still_deciding | needs_info */
  outcomeDetail?: string | null;
  /** Client-side timestamp in ms (Date.now()). */
  queuedAt: number;
  /** Lifetime retry attempts (persisted in IDB). */
  retryCount: number;
  /** Timestamp of the last sync attempt, or null if never tried. */
  lastAttemptedAt: number | null;
  /** Last error message, or null if never failed. */
  lastError: string | null;
  /** pending = will be synced on next flush; parked = exceeded retry cap, needs manual action. */
  status: "pending" | "parked";
}

// ── DB lifecycle ──────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      // v1→v2: store is schemaless; new retry fields default on read.
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const req = fn(store);

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => db.close();
      })
  );
}

// Normalizes a raw IDB record to a full QueuedResponse (handles v1 records
// that lack the retry fields introduced in DB_VERSION 2).
function normalize(raw: Partial<QueuedResponse>): QueuedResponse {
  return {
    ...(raw as QueuedResponse),
    retryCount: raw.retryCount ?? 0,
    lastAttemptedAt: raw.lastAttemptedAt ?? null,
    lastError: raw.lastError ?? null,
    status: raw.status ?? "pending",
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

const DEDUP_WINDOW_MS = 30_000;

/**
 * Adds a response to the queue.
 *
 * Returns `{ isDuplicate: true }` when an identical assignmentId+personId was
 * enqueued within the last 30 seconds — catches accidental double-taps while
 * offline without blocking intentional re-visits.
 */
export async function enqueue(
  item: Omit<QueuedResponse, "id" | "queuedAt" | "retryCount" | "lastAttemptedAt" | "lastError" | "status">
): Promise<{ isDuplicate: boolean }> {
  const pending = await getPending();
  const now = Date.now();
  const isDuplicate = pending.some(
    (q) =>
      q.assignmentId === item.assignmentId &&
      q.personId === item.personId &&
      now - q.queuedAt < DEDUP_WINDOW_MS
  );
  if (isDuplicate) return { isDuplicate: true };

  const record: QueuedResponse = {
    ...item,
    id: crypto.randomUUID(),
    queuedAt: now,
    retryCount: 0,
    lastAttemptedAt: null,
    lastError: null,
    status: "pending",
  };
  await withStore("readwrite", (store) => store.add(record));
  return { isDuplicate: false };
}

/** Returns ALL queued items sorted oldest-first. Normalizes v1 records. */
export function getAll(): Promise<QueuedResponse[]> {
  return openDb().then(
    (db) =>
      new Promise<QueuedResponse[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll() as IDBRequest<Partial<QueuedResponse>[]>;

        req.onsuccess = () => {
          const sorted = req.result
            .map(normalize)
            .slice()
            .sort((a, b) => a.queuedAt - b.queuedAt);
          resolve(sorted);
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

/** Returns only items with status="pending" (will be attempted on next flush). */
export function getPending(): Promise<QueuedResponse[]> {
  return getAll().then((items) => items.filter((i) => i.status === "pending"));
}

/** Returns only items with status="parked" (exceeded retry cap, need manual action). */
export function getParked(): Promise<QueuedResponse[]> {
  return getAll().then((items) => items.filter((i) => i.status === "parked"));
}

/** Removes a single item from the queue by its local id. */
export function remove(id: string): Promise<void> {
  return withStore("readwrite", (store) => store.delete(id)).then(
    () => undefined
  );
}

/** Returns the current number of items in the queue (all statuses). */
export function count(): Promise<number> {
  return withStore<number>("readonly", (store) => store.count());
}

/**
 * Updates retry-tracking fields on an existing item without removing it.
 * Used by useOfflineSync to persist retry state across page reloads.
 */
export function updateRetryState(
  id: string,
  fields: Partial<Pick<QueuedResponse, "retryCount" | "lastAttemptedAt" | "lastError" | "status">>
): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id) as IDBRequest<Partial<QueuedResponse> | undefined>;

        getReq.onsuccess = () => {
          const existing = getReq.result;
          if (!existing) { resolve(); return; }
          const updated = { ...normalize(existing), ...fields };
          const putReq = store.put(updated);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => db.close();
      })
  );
}
