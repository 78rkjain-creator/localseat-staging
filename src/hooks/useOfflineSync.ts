"use client";

/**
 * useOfflineSync — flushes the offline canvass queue when connectivity returns.
 *
 * SYNC STRATEGY:
 * Items are synced in queuedAt order (oldest first). Each item is attempted up
 * to MAX_RETRIES times before being removed from the queue and logged as dropped.
 * Items that fail do NOT block later items — the flush continues to the next
 * item so a single permanently-rejected entry cannot freeze the whole queue.
 *
 * Retry counts are tracked in memory (resets on page reload). A permanent server
 * rejection (e.g. assignment deleted) will hit MAX_RETRIES across 3 online events,
 * after which the item is removed and reported to the user via droppedCount.
 *
 * Sync is triggered:
 *   1. On component mount (handles tab reopen while already online)
 *   2. Whenever navigator.onLine transitions to true
 *
 * CURRENT LIMITATIONS:
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

const MAX_RETRIES = 3;

export interface OfflineSyncState {
  /** Number of items currently waiting in the local queue. */
  pendingCount: number;
  /** True while a flush is actively in progress. */
  isSyncing: boolean;
  /** Timestamp of the last completed flush attempt (null until first attempt). */
  lastSyncedAt: Date | null;
  /** Number of items permanently dropped this session (failed MAX_RETRIES times). */
  droppedCount: number;
  /** Call after enqueue() to immediately reflect the new pending count. */
  refresh: () => Promise<void>;
}

export function useOfflineSync(syncFn: SyncFn): OfflineSyncState {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [droppedCount, setDroppedCount] = useState(0);

  // Ref prevents concurrent flushes if two online events fire close together.
  const isSyncingRef = useRef(false);

  // Per-session retry counts keyed by item.id. Resets on page reload which is
  // acceptable — stale items get fresh attempts after reload.
  const retryCountsRef = useRef<Map<string, number>>(new Map());

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
      const retries = retryCountsRef.current.get(item.id) ?? 0;

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
          queuedAt: item.queuedAt,
        });

        if (result.error) {
          const newRetries = retries + 1;
          retryCountsRef.current.set(item.id, newRetries);

          if (newRetries >= MAX_RETRIES) {
            // Permanently rejected — remove from queue, report to user.
            console.error(
              `[useOfflineSync] Item ${item.id} rejected ${MAX_RETRIES} times, dropping.`,
              { item, error: result.error }
            );
            await remove(item.id).catch(() => {});
            retryCountsRef.current.delete(item.id);
            setPendingCount((n) => Math.max(0, n - 1));
            setDroppedCount((n) => n + 1);
          }
          // Continue to next item — do not break.
          continue;
        }

        // Success — remove from queue and clear retry count.
        await remove(item.id);
        retryCountsRef.current.delete(item.id);
        setPendingCount((n) => Math.max(0, n - 1));
      } catch {
        // Network error — increment retries but continue to next item.
        const newRetries = retries + 1;
        retryCountsRef.current.set(item.id, newRetries);

        if (newRetries >= MAX_RETRIES) {
          console.error(
            `[useOfflineSync] Item ${item.id} failed with network error ${MAX_RETRIES} times, dropping.`,
            { item }
          );
          await remove(item.id).catch(() => {});
          retryCountsRef.current.delete(item.id);
          setPendingCount((n) => Math.max(0, n - 1));
          setDroppedCount((n) => n + 1);
        }
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

  return { pendingCount, isSyncing, lastSyncedAt, droppedCount, refresh };
}
