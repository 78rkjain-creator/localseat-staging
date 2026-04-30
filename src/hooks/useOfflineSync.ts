"use client";

/**
 * useOfflineSync — flushes the offline canvass queue when connectivity returns.
 *
 * SYNC STRATEGY:
 * Items are synced in queuedAt order (oldest first), skipping parked items.
 * Retry state is persisted in IndexedDB so counts survive page reloads.
 *
 * Failure classification:
 *   - Network error (fetch throws): transient — retry up to MAX_RETRIES, then park.
 *   - result.permanent === true: park immediately (e.g. assignment deleted).
 *   - Other result.error: count toward cap — park after MAX_RETRIES lifetime failures.
 *
 * Parked items do not block the queue. The canvasser can retry or discard them
 * from the parked items panel in the canvass screen.
 *
 * Sync is triggered:
 *   1. On component mount (handles tab reopen while already online)
 *   2. Whenever navigator.onLine transitions to true
 */

import { useEffect, useState, useRef, useCallback } from "react";
import {
  getPending,
  getParked,
  remove,
  updateRetryState,
} from "@/lib/offline-queue";
import type { QueuedResponse } from "@/lib/offline-queue";
import type { SaveResponseInput } from "@/app/(app)/canvassing/[listId]/canvass/actions";

type SyncFn = (
  input: SaveResponseInput
) => Promise<{ error?: string; responseId?: string; permanent?: boolean }>;

const MAX_RETRIES = 3;

export interface OfflineSyncState {
  /** Items waiting to sync (status="pending"). */
  pendingCount: number;
  /** Items that exceeded the retry cap and need manual action. */
  parkedCount: number;
  /** The full list of parked items for the review panel. */
  parkedItems: QueuedResponse[];
  /** True while a flush is actively in progress. */
  isSyncing: boolean;
  /** Timestamp of the last completed flush attempt (null until first attempt). */
  lastSyncedAt: Date | null;
  /** Re-reads counts from IDB. Call after enqueue() to reflect the new item. */
  refresh: () => Promise<void>;
  /** Resets a parked item to pending and triggers a flush. */
  retryParked: (id: string) => Promise<void>;
  /** Permanently removes a parked item from the queue. */
  discardParked: (id: string) => Promise<void>;
}

export function useOfflineSync(syncFn: SyncFn): OfflineSyncState {
  const [pendingCount, setPendingCount] = useState(0);
  const [parkedCount, setParkedCount] = useState(0);
  const [parkedItems, setParkedItems] = useState<QueuedResponse[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Prevents concurrent flushes if two online events fire close together.
  const isSyncingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [pending, parked] = await Promise.all([getPending(), getParked()]);
      setPendingCount(pending.length);
      setParkedCount(parked.length);
      setParkedItems(parked);
    } catch {
      // IndexedDB unavailable — leave counts as-is
    }
  }, []);

  const flush = useCallback(async () => {
    if (isSyncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    let items: QueuedResponse[];
    try {
      items = await getPending();
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
          competitorId: item.competitorId,
          outcomeDetail: item.outcomeDetail ?? null,
          queuedAt: item.queuedAt,
        });

        if (result.error) {
          const now = Date.now();
          const newRetries = item.retryCount + 1;

          if (result.permanent || newRetries >= MAX_RETRIES) {
            // Permanent failure or retry cap reached — park the item.
            await updateRetryState(item.id, {
              retryCount: newRetries,
              lastAttemptedAt: now,
              lastError: result.error,
              status: "parked",
            }).catch(() => {});
          } else {
            await updateRetryState(item.id, {
              retryCount: newRetries,
              lastAttemptedAt: now,
              lastError: result.error,
            }).catch(() => {});
          }
          // Continue — do not let this item block later items.
          continue;
        }

        // Success — remove from queue.
        await remove(item.id).catch(() => {});
      } catch {
        // Network/fetch error — transient.
        const now = Date.now();
        const newRetries = item.retryCount + 1;
        const errorMsg = "Network error — will retry when online.";

        if (newRetries >= MAX_RETRIES) {
          await updateRetryState(item.id, {
            retryCount: newRetries,
            lastAttemptedAt: now,
            lastError: errorMsg,
            status: "parked",
          }).catch(() => {});
        } else {
          await updateRetryState(item.id, {
            retryCount: newRetries,
            lastAttemptedAt: now,
            lastError: errorMsg,
          }).catch(() => {});
        }
        // Continue — network errors on one item don't block others.
      }
    }

    setLastSyncedAt(new Date());
    isSyncingRef.current = false;
    setIsSyncing(false);
    await refresh();
  }, [syncFn, refresh]);

  const retryParked = useCallback(
    async (id: string) => {
      await updateRetryState(id, {
        retryCount: 0,
        status: "pending",
        lastError: null,
      }).catch(() => {});
      await refresh();
      flush(); // fire-and-forget — user sees pending count update immediately
    },
    [flush, refresh]
  );

  const discardParked = useCallback(
    async (id: string) => {
      await remove(id).catch(() => {});
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
    flush();

    const handleOnline = () => flush();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flush, refresh]);

  return {
    pendingCount,
    parkedCount,
    parkedItems,
    isSyncing,
    lastSyncedAt,
    refresh,
    retryParked,
    discardParked,
  };
}
