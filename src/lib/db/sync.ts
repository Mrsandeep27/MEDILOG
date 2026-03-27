"use client";

import { db } from "./dexie";
import type { SyncStatus } from "./schema";

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
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

async function _doSync(): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, errors: [] };

  try {
    // ── PUSH: Collect all pending items across all tables ──
    const pushPayload: Record<string, Record<string, unknown>[]> = {};

    for (const { local, remote } of TABLES_TO_SYNC) {
      const dexieTable = db.table(local);
      const pendingItems = await dexieTable
        .where("sync_status")
        .equals("pending")
        .toArray();

      if (pendingItems.length > 0) {
        pushPayload[remote] = pendingItems.map((item: Record<string, unknown>) => {
          const clean: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(item)) {
            if (!LOCAL_ONLY_FIELDS.has(key)) clean[key] = value;
          }
          return clean;
        });
      }
    }

    // Single POST for all tables with pending data
    if (Object.keys(pushPayload).length > 0) {
      try {
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tables: pushPayload }),
        });

        if (response.ok) {
          const data = await response.json();
          result.pushed = data.pushed || 0;
          if (data.errors) result.errors.push(...data.errors);

          // Mark synced locally
          if (result.pushed > 0) {
            const now = new Date().toISOString();
            for (const { local, remote } of TABLES_TO_SYNC) {
              if (pushPayload[remote]) {
                const dexieTable = db.table(local);
                const ids = pushPayload[remote].map((i) => i.id as string);
                for (const id of ids) {
                  await dexieTable.update(id, { sync_status: "synced", synced_at: now });
                }
              }
            }
          }
        } else {
          result.errors.push(`Push failed: HTTP ${response.status}`);
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
      const response = await fetch("/api/sync?" + new URLSearchParams({
        tables: JSON.stringify(sinceMap),
      }));

      if (response.ok) {
        const { data } = await response.json();

        if (data && typeof data === "object") {
          for (const { local, remote } of TABLES_TO_SYNC) {
            const serverItems = data[remote];
            if (!Array.isArray(serverItems) || serverItems.length === 0) continue;

            const dexieTable = db.table(local);
            for (const serverItem of serverItems) {
              const localItem = await dexieTable.get(serverItem.id);
              if (
                !localItem ||
                new Date(serverItem.updated_at) > new Date(localItem.updated_at)
              ) {
                await dexieTable.put({
                  ...serverItem,
                  sync_status: "synced" as SyncStatus,
                  synced_at: new Date().toISOString(),
                });
                result.pulled++;
              }
            }

            // Update timestamp
            const latest = serverItems.reduce(
              (max: string, item: { updated_at: string }) =>
                item.updated_at > max ? item.updated_at : max,
              sinceMap[remote]
            );
            setSyncTimestamp(remote, latest);
          }
        }
      }
    } catch (err) {
      result.errors.push(`Pull: ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (err) {
    result.errors.push(`Sync: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

// Per-table sync timestamps
function getSyncTimestamp(table: string): string {
  if (typeof window === "undefined") return new Date(0).toISOString();
  return localStorage.getItem(`medilog_sync_${table}`) || new Date(0).toISOString();
}

function setSyncTimestamp(table: string, timestamp: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(`medilog_sync_${table}`, timestamp);
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
