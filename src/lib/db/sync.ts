"use client";

import { db } from "./dexie";
import { createClient } from "@/lib/supabase/client";
import type { SyncStatus } from "./schema";

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
}

const TABLES_TO_SYNC = [
  "members",
  "records",
  "medicines",
  "reminders",
  "reminderLogs",
  "shareLinks",
  "healthMetrics",
] as const;

type SyncTable = (typeof TABLES_TO_SYNC)[number];

const TABLE_MAP: Record<SyncTable, string> = {
  members: "members",
  records: "health_records",
  medicines: "medicines",
  reminders: "reminders",
  reminderLogs: "reminder_logs",
  shareLinks: "share_links",
  healthMetrics: "health_metrics",
};

export async function syncAll(): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, errors: [] };
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    result.errors.push("Not authenticated");
    return result;
  }

  for (const table of TABLES_TO_SYNC) {
    try {
      const tableResult = await syncTable(table, user.id);
      result.pushed += tableResult.pushed;
      result.pulled += tableResult.pulled;
      result.errors.push(...tableResult.errors);
    } catch (err) {
      result.errors.push(`${table}: ${(err as Error).message}`);
    }
  }

  return result;
}

async function syncTable(
  tableName: SyncTable,
  userId: string
): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, errors: [] };
  const supabase = createClient();
  const supabaseTable = TABLE_MAP[tableName];
  const dexieTable = db.table(tableName);

  // Push: local pending → server
  const pendingItems = await dexieTable
    .filter((item: { sync_status: SyncStatus }) => item.sync_status === "pending")
    .toArray();

  for (const item of pendingItems) {
    try {
      const { local_image_blobs, ...cleanItem } = item as Record<string, unknown>;
      const { error } = await supabase
        .from(supabaseTable)
        .upsert(cleanItem as Record<string, unknown>, { onConflict: "id" });

      if (error) {
        result.errors.push(`Push ${tableName}/${item.id}: ${error.message}`);
      } else {
        await dexieTable.update(item.id, {
          sync_status: "synced",
          synced_at: new Date().toISOString(),
        });
        result.pushed++;
      }
    } catch (err) {
      result.errors.push(
        `Push ${tableName}/${item.id}: ${(err as Error).message}`
      );
    }
  }

  // Pull: server → local (newer than last sync)
  try {
    const lastSynced = await dexieTable
      .orderBy("synced_at")
      .reverse()
      .first();
    const since = lastSynced?.synced_at || "2000-01-01T00:00:00Z";

    let query = supabase
      .from(supabaseTable)
      .select("*")
      .gt("updated_at", since);

    // Filter by user ownership — members have user_id directly,
    // other tables are filtered by member_id belonging to the user's members
    if (tableName === "members") {
      query = query.eq("user_id", userId);
    } else {
      // Get user's member IDs to scope the pull
      const userMembers = await db.members
        .where("user_id")
        .equals(userId)
        .toArray();
      const memberIds = userMembers.map((m) => m.id);
      if (memberIds.length > 0 && "member_id" in (await dexieTable.toCollection().first() || {})) {
        query = query.in("member_id", memberIds);
      }
    }

    const { data, error } = await query;

    if (error) {
      result.errors.push(`Pull ${tableName}: ${error.message}`);
    } else if (data) {
      for (const serverItem of data) {
        const localItem = await dexieTable.get(serverItem.id);
        if (
          !localItem ||
          new Date(serverItem.updated_at) > new Date(localItem.updated_at)
        ) {
          await dexieTable.put({
            ...serverItem,
            sync_status: "synced",
            synced_at: new Date().toISOString(),
          });
          result.pulled++;
        }
      }
    }
  } catch (err) {
    result.errors.push(`Pull ${tableName}: ${(err as Error).message}`);
  }

  return result;
}

export async function getPendingCount(): Promise<number> {
  let count = 0;
  for (const table of TABLES_TO_SYNC) {
    const items = await db
      .table(table)
      .filter((item: { sync_status: SyncStatus }) => item.sync_status === "pending")
      .count();
    count += items;
  }
  return count;
}
