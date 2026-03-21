"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { syncAll, getPendingCount, type SyncResult } from "@/lib/db/sync";
import { useOnline } from "@/hooks/use-online";
import { useAuthStore } from "@/stores/auth-store";
import { SYNC_INTERVAL_MS } from "@/constants/config";

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const isOnline = useOnline();
  const user = useAuthStore((s) => s.user);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);
  const isOnlineRef = useRef(isOnline);

  // Keep refs in sync with state
  isOnlineRef.current = isOnline;

  const sync = useCallback(async () => {
    if (!isOnlineRef.current || !user || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncAll();
      setLastResult(result);
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [user]);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (err) {
      console.error("Failed to get pending count:", err);
    }
  }, []);

  // Auto-sync on interval
  useEffect(() => {
    if (!isOnline || !user) return;

    // Sync immediately on mount
    sync();

    intervalRef.current = setInterval(sync, SYNC_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline, user, sync]);

  return {
    isSyncing,
    lastResult,
    pendingCount,
    sync,
    refreshPendingCount,
  };
}
