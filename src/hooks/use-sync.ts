"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { syncAll, getPendingCount, type SyncResult } from "@/lib/db/sync";
import { useOnline } from "@/hooks/use-online";
import { useAuthStore } from "@/stores/auth-store";
import { SYNC_INTERVAL_MS } from "@/constants/config";
import { toast } from "sonner";

// Global: prevent multiple sync loops across re-renders/components
let syncLoopRunning = false;

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const isOnline = useOnline();
  const user = useAuthStore((s) => s.user);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (!isOnline || !user || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncAll();
      setLastResult(result);
      const count = await getPendingCount();
      setPendingCount(count);

      // Notify user if sync had errors and data is stuck locally
      if (result.errors.length > 0 && count > 0) {
        toast.error("Some data failed to sync and is only stored on this device.", {
          duration: 5000,
        });
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, user]);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {}
  }, []);

  // Auto-sync: delay first sync 3s after mount, then every 30 min
  useEffect(() => {
    if (!isOnline || !user || syncLoopRunning) return;
    syncLoopRunning = true;

    // Delay initial sync to let app load first (reduces burst on page open)
    const initTimeout = setTimeout(() => sync(), 3000);

    intervalRef.current = setInterval(sync, SYNC_INTERVAL_MS);
    return () => {
      clearTimeout(initTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
      syncLoopRunning = false;
    };
  }, [isOnline, user, sync]);

  return { isSyncing, lastResult, pendingCount, sync, refreshPendingCount };
}
