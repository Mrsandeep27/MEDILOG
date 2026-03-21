"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type {
  Reminder,
  ReminderLog,
  ReminderStatus,
  DayOfWeek,
  Frequency,
} from "@/lib/db/schema";

export interface ReminderFormData {
  medicine_id: string;
  member_id: string;
  medicine_name: string;
  member_name: string;
  dosage?: string;
  before_food: boolean;
  time: string;
  days: DayOfWeek[];
  is_active: boolean;
}

const ALL_DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function useReminders(memberId?: string) {
  const reminders = useLiveQuery(
    () =>
      db.reminders
        .filter(
          (r) =>
            !r.is_deleted &&
            (memberId ? r.member_id === memberId : true)
        )
        .toArray(),
    [memberId]
  );

  // Use date string as dependency so it refreshes after midnight
  const todayStr = new Date().toDateString();
  const todayReminders = useLiveQuery(() => {
    const today = getDayOfWeek();
    return db.reminders
      .filter((r) => !r.is_deleted && r.is_active && r.days.includes(today))
      .toArray();
  }, [todayStr]);

  const addReminder = async (data: ReminderFormData): Promise<string> => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const reminder: Reminder = {
      id,
      medicine_id: data.medicine_id,
      member_id: data.member_id,
      medicine_name: data.medicine_name,
      member_name: data.member_name,
      dosage: data.dosage,
      before_food: data.before_food,
      time: data.time,
      days: data.days.length > 0 ? data.days : ALL_DAYS,
      is_active: true,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };
    await db.reminders.add(reminder);
    return id;
  };

  const updateReminder = async (
    id: string,
    data: Partial<ReminderFormData>
  ): Promise<void> => {
    await db.reminders.update(id, {
      ...data,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  const toggleReminder = async (id: string): Promise<void> => {
    await db.transaction("rw", db.reminders, async () => {
      const reminder = await db.reminders.get(id);
      if (!reminder) return;
      await db.reminders.update(id, {
        is_active: !reminder.is_active,
        updated_at: new Date().toISOString(),
        sync_status: "pending",
      });
    });
  };

  const deleteReminder = async (id: string): Promise<void> => {
    await db.reminders.update(id, {
      is_deleted: true,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  const logReminder = async (
    reminderId: string,
    status: ReminderStatus
  ): Promise<void> => {
    // Build the scheduled_at from the reminder's time + today's date
    const reminder = await db.reminders.get(reminderId);
    const now = new Date();
    let scheduledAt = now.toISOString();
    if (reminder?.time) {
      const [hours, minutes] = reminder.time.split(":").map(Number);
      const scheduled = new Date(now);
      scheduled.setHours(hours, minutes, 0, 0);
      scheduledAt = scheduled.toISOString();
    }

    const id = uuidv4();
    const log: ReminderLog = {
      id,
      reminder_id: reminderId,
      scheduled_at: scheduledAt,
      status,
      acted_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      sync_status: "pending",
      is_deleted: false,
    };
    await db.reminderLogs.add(log);
  };

  return {
    reminders: reminders ?? [],
    todayReminders: todayReminders ?? [],
    isLoading: reminders === undefined,
    addReminder,
    updateReminder,
    toggleReminder,
    deleteReminder,
    logReminder,
  };
}

export function useReminderLogs(reminderId?: string) {
  const logs = useLiveQuery(
    () => {
      if (!reminderId) {
        return db.reminderLogs.toArray().then((logs) =>
          logs.sort((a, b) =>
            new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
          )
        );
      }
      return db.reminderLogs
        .where("reminder_id")
        .equals(reminderId)
        .toArray()
        .then((logs) =>
          logs.sort((a, b) =>
            new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
          )
        );
    },
    [reminderId]
  );

  return { logs: logs ?? [], isLoading: logs === undefined };
}

export function createRemindersFromFrequency(
  frequency: Frequency
): { time: string; days: DayOfWeek[] }[] {
  switch (frequency) {
    case "once_daily":
      return [{ time: "09:00", days: ALL_DAYS }];
    case "twice_daily":
      return [
        { time: "09:00", days: ALL_DAYS },
        { time: "21:00", days: ALL_DAYS },
      ];
    case "thrice_daily":
      return [
        { time: "08:00", days: ALL_DAYS },
        { time: "14:00", days: ALL_DAYS },
        { time: "21:00", days: ALL_DAYS },
      ];
    case "weekly":
      return [{ time: "09:00", days: ["mon"] }];
    default:
      return [{ time: "09:00", days: ALL_DAYS }];
  }
}

function getDayOfWeek(): DayOfWeek {
  const days: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return days[new Date().getDay()];
}
