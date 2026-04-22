/**
 * offline-queue.ts — IndexedDB queue for canvass responses captured while offline.
 *
 * OFFLINE STRATEGY:
 * When the device has no network connection, canvass responses are written to
 * IndexedDB instead of being sent to the server. When connectivity is restored,
 * the useOfflineSync hook reads this queue and flushes items in order by calling
 * the saveCanvassResponse server action.
 *
 * CURRENT LIMITATIONS:
 * - Queue is per-browser, per-device. Items on device A are invisible to device B.
 * - Items are stored unencrypted in the browser's local storage. This matches the
 *   security posture of the rest of the app — the canvasser is already authenticated.
 * - Concurrent browser tabs could attempt to sync the same queue simultaneously.
 *   In V1, the canvassing workflow is single-tab only so this is acceptable.
 * - If saveCanvassResponse rejects an item (e.g. assignment deleted server-side),
 *   that item blocks all later items until manually cleared. There is no per-item
 *   retry limit in V1.
 * - Queued items include a local queuedAt timestamp. The server action applies its
 *   own server-side timestamp on the respondedAt field, so canvass times in the
 *   database reflect sync time, not the moment the door was knocked. This is a
 *   known V1 limitation.
 */

import type { SupportLevel, CanvassOutcome } from "@/types";

const DB_NAME = "localseat_offline";
const STORE_NAME = "canvass_queue";
const DB_VERSION = 1;

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
  /** Client-side timestamp in ms (Date.now()). */
  queuedAt: number;
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
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Opens a transaction, runs fn against the object store, and returns the
 * resolved IDBRequest result. Closes the DB after the transaction completes.
 */
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

// ── Public API ────────────────────────────────────────────────────────────────

/** Adds a response to the end of the queue. Assigns a local UUID and timestamp. */
export function enqueue(
  item: Omit<QueuedResponse, "id" | "queuedAt">
): Promise<void> {
  const record: QueuedResponse = {
    ...item,
    id: crypto.randomUUID(),
    queuedAt: Date.now(),
  };
  return withStore("readwrite", (store) => store.add(record)).then(
    () => undefined
  );
}

/** Returns all queued items sorted oldest-first (ascending queuedAt). */
export function getAll(): Promise<QueuedResponse[]> {
  return openDb().then(
    (db) =>
      new Promise<QueuedResponse[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll() as IDBRequest<QueuedResponse[]>;

        req.onsuccess = () => {
          const sorted = req.result.slice().sort(
            (a, b) => a.queuedAt - b.queuedAt
          );
          resolve(sorted);
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

/** Removes a single item from the queue by its local id. */
export function remove(id: string): Promise<void> {
  return withStore("readwrite", (store) => store.delete(id)).then(
    () => undefined
  );
}

/** Returns the current number of items in the queue. */
export function count(): Promise<number> {
  return withStore<number>("readonly", (store) => store.count());
}
