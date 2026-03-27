"use client";

import { db } from "./dexie";
import type { SyncStatus } from "./schema";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
  hasMore?: boolean;
}

const TABLES_TO_SYNC = [
  { local: "members", remote: "members" },
  { local: "records", remote: "health_records" },
  { local: "medicines", remote: "medicines" },
  { local: "reminders", remote: "reminders" },
  { local: "reminderLogs", remote: "reminder_logs" },
  { local: "shareLinks", remote: "share_links" },
  { local: "healthMetrics", remote: "health_metrics" },
] as const;

// Fields that should NOT be sent to the server
const LOCAL_ONLY_FIELDS = new Set(["local_image_blobs", "sync_status", "synced_at"]);

// Async lock: prevents overlapping syncs (Promise-based, truly atomic)
let activeSyncPromise: Promise<SyncResult> | null = null;

/**
 * Batched sync — ONE API call for push, ONE for pull (instead of 14)
 */
export async function syncAll(): Promise<SyncResult> {
  // If sync is already running, wait for it instead of starting a new one
  if (activeSyncPromise) return activeSyncPromise;

  activeSyncPromise = _doSync();
  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

// Get Supabase access token for authenticated API calls
async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      // Check if token expires within 60s — if so, force a refresh
      const expiresAt = data.session.expires_at;
      if (expiresAt && expiresAt - Math.floor(Date.now() / 1000) < 60) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        return refreshed.session?.access_token ?? data.session.access_token;
      }
      return data.session.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

async function _doSync(): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, errors: [] };
  const token = await getAuthToken();

  try {
    // ── PUSH: Collect all pending items across all tables ──
    const pushPayload: Record<string, Record<string, unknown>[]> = {};
    const pushTimestamps = new Map<string, string>();

    for (const { local, remote } of TABLES_TO_SYNC) {
      const dexieTable = db.table(local);
      const pendingItems = await dexieTable
        .where("sync_status")
        .equals("pending")
        .toArray();

      if (pendingItems.length > 0) {
        // Cap at 100 to match server limit — remainder syncs next cycle
        pushPayload[remote] = pendingItems.slice(0, 100).map((item: Record<string, unknown>) => {
          const clean: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(item)) {
            if (!LOCAL_ONLY_FIELDS.has(key)) clean[key] = value;
          }
          pushTimestamps.set(item.id as string, item.updated_at as string);
          return clean;
        });
      }
    }

    // Single POST for all tables with pending data
    if (Object.keys(pushPayload).length > 0) {
      try {
        const pushHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (token) pushHeaders["Authorization"] = `Bearer ${token}`;
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: pushHeaders,
          body: JSON.stringify({ tables: pushPayload }),
        });

        if (response.ok) {
          const data = await response.json();
          result.pushed = data.pushed || 0;
          if (data.errors) result.errors.push(...data.errors);

          // Mark synced — skip failed items and guard against mid-sync edits
          const failedIds = new Set<string>(
            Array.isArray(data.failedIds) ? data.failedIds : []
          );
          const now = new Date().toISOString();
          for (const { local, remote } of TABLES_TO_SYNC) {
            if (pushPayload[remote]) {
              const dexieTable = db.table(local);
              const ids = pushPayload[remote].map((i) => i.id as string);
              for (const id of ids) {
                if (failedIds.has(id)) continue;
                // Only mark synced if item wasn't edited while push was in-flight
                const current = await dexieTable.get(id);
                if (current && current.updated_at === pushTimestamps.get(id)) {
                  await dexieTable.update(id, { sync_status: "synced", synced_at: now });
                }
              }
            }
          }
        } else {
          result.errors.push(`Push failed: HTTP ${response.status}`);
          // Auth failed — pull will fail too, skip it
          if (response.status === 401 || response.status === 403) return result;
        }
      } catch (err) {
        result.errors.push(`Push: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── PULL: Single GET with all table timestamps ──
    const sinceMap: Record<string, string> = {};
    for (const { remote } of TABLES_TO_SYNC) {
      sinceMap[remote] = getSyncTimestamp(remote);
    }

    try {
      const pullHeaders: Record<string, string> = {};
      if (token) pullHeaders["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/sync?" + new URLSearchParams({
        tables: JSON.stringify(sinceMap),
      }), { headers: pullHeaders });

      if (response.ok) {
        const { data } = await response.json();

        if (data && typeof data === "object") {
          for (const { local, remote } of TABLES_TO_SYNC) {
            const serverItems = data[remote];
            if (!Array.isArray(serverItems) || serverItems.length === 0) continue;

            const dexieTable = db.table(local);
            let latestProcessed = sinceMap[remote];

            for (const serverItem of serverItems) {
              try {
                const localItem = await dexieTable.get(serverItem.id);

                // Never overwrite local pending changes — they haven't pushed yet
                // Don't advance watermark past them so they're re-fetched next cycle
                if (localItem?.sync_status === "pending") continue;

                if (
                  !localItem ||
                  new Date(serverItem.updated_at) > new Date(localItem.updated_at)
                ) {
                  // Preserve local-only fields the server doesn't have
                  const preserved: Record<string, unknown> = {};
                  if (localItem?.local_image_blobs) {
                    preserved.local_image_blobs = localItem.local_image_blobs;
                  }

                  await dexieTable.put({
                    ...serverItem,
                    ...preserved,
                    sync_status: "synced" as SyncStatus,
                    synced_at: new Date().toISOString(),
                  });
                  result.pulled++;
                }

                // Advance watermark only for non-skipped items
                if (serverItem.updated_at > latestProcessed) {
                  latestProcessed = serverItem.updated_at;
                }
              } catch (err) {
                result.errors.push(`Pull ${serverItem.id}: ${err instanceof Error ? err.message : String(err)}`);
              }
            }

            // Only advance timestamp based on items actually processed
            setSyncTimestamp(remote, latestProcessed);
          }
        }
      }
    } catch (err) {
      result.errors.push(`Pull: ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (err) {
    result.errors.push(`Sync: ${err instanceof Error ? err.message : String(err)}`);
  }

  // If we pushed items but there are still pending ones, schedule an immediate follow-up
  if (result.pushed > 0) {
    const remaining = await getPendingCount();
    if (remaining > 0) {
      result.hasMore = true;
    }
  }

  return result;
}

// Per-table, per-user sync timestamps
// Scoped by user ID so shared devices don't cross-contaminate
function getSyncTimestamp(table: string): string {
  if (typeof window === "undefined") return new Date(0).toISOString();
  const userId = useAuthStore.getState().user?.id;
  const key = userId ? `medilog_sync_${userId}_${table}` : `medilog_sync_${table}`;
  return localStorage.getItem(key) || new Date(0).toISOString();
}

function setSyncTimestamp(table: string, timestamp: string): void {
  if (typeof window !== "undefined") {
    const userId = useAuthStore.getState().user?.id;
    const key = userId ? `medilog_sync_${userId}_${table}` : `medilog_sync_${table}`;
    localStorage.setItem(key, timestamp);
  }
}

export async function getPendingCount(): Promise<number> {
  let count = 0;
  for (const { local } of TABLES_TO_SYNC) {
    const items = await db.table(local).where("sync_status").equals("pending").count();
    count += items;
  }
  return count;
}
