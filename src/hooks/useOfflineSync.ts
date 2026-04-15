"use client";

/**
 * useOfflineSync — flushes the offline canvass queue when connectivity returns.
 *
 * SYNC STRATEGY:
 * Items are synced in queuedAt order (oldest first). Each item is removed from
 * the queue only after the server action confirms success. If any item fails,
 * the flush stops immediately — later items are NOT skipped or reordered. This
 * preserves chronological ordering of canvass records and prevents partial
 * state in the database.
 *
 * Sync is triggered:
 *   1. On component mount (handles tab reopen while already online)
 *   2. Whenever navigator.onLine transitions to true
 *
 * CURRENT LIMITATIONS:
 * - If a queued item is permanently rejected by the server (e.g. the assignment
 *   was deleted), it will block all later items indefinitely. There is no
 *   per-item skip or discard mechanism in V1. The canvasser would need to clear
 *   the queue by refreshing — which in practice should be extremely rare.
 * - lastSyncedAt is not persisted across page loads; it resets on mount.
 * - The sync function is passed as a parameter so this hook is not coupled to a
 *   specific page path. Callers must pass saveCanvassResponse from their actions
 *   module.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { getAll, remove } from "@/lib/offline-queue";
import type { SaveResponseInput } from "@/app/(app)/canvassing/[listId]/canvass/actions";

type SyncFn = (
  input: SaveResponseInput
) => Promise<{ error?: string; responseId?: string }>;

export interface OfflineSyncState {
  /** Number of items currently waiting in the local queue. */
  pendingCount: number;
  /** True while a flush is actively in progress. */
  isSyncing: boolean;
  /** Timestamp of the last completed flush attempt (null until first attempt). */
  lastSyncedAt: Date | null;
  /** Call after enqueue() to immediately reflect the new pending count. */
  refresh: () => Promise<void>;
}

export function useOfflineSync(syncFn: SyncFn): OfflineSyncState {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Ref prevents concurrent flushes if two online events fire close together.
  const isSyncingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const items = await getAll();
      setPendingCount(items.length);
    } catch {
      // IndexedDB unavailable — leave count as-is
    }
  }, []);

  const flush = useCallback(async () => {
    if (isSyncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    let items;
    try {
      items = await getAll();
    } catch {
      return;
    }

    if (items.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    for (const item of items) {
      try {
        const result = await syncFn({
          assignmentId: item.assignmentId,
          personId: item.personId,
          outcome: item.outcome,
          supportLevel: item.supportLevel,
          signRequest: item.wantsSign,
          volunteerInterest: item.isVolunteer,
          donorInterest: item.isDonorInterest,
          notes: item.notes,
          needsFollowUp: item.needsFollowUp,
        });

        if (result.error) {
          // Server rejected — stop flush, retry on next online event.
          break;
        }

        await remove(item.id);
        setPendingCount((n) => Math.max(0, n - 1));
      } catch {
        // Network error — stop flush, retry on next online event.
        break;
      }
    }

    setLastSyncedAt(new Date());
    isSyncingRef.current = false;
    setIsSyncing(false);
  }, [syncFn]);

  useEffect(() => {
    // Read initial count from IndexedDB on mount.
    refresh();

    // Attempt flush on mount in case the tab was reopened while online.
    flush();

    const handleOnline = () => flush();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flush, refresh]);

  return { pendingCount, isSyncing, lastSyncedAt, refresh };
}
