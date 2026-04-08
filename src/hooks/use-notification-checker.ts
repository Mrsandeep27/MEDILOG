"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { useAuthStore } from "@/stores/auth-store";
import {
  requestNotificationPermission,
  showReminderNotification,
  showAppointmentNotification,
} from "@/lib/notifications/web-push";

const CHECK_INTERVAL_MS = 60_000; // Check every 60 seconds
const APPT_LEAD_MS = 3 * 60 * 60 * 1000; // 3 hours
const APPT_WINDOW_MS = 60_000; // ±1 minute window for "now ≈ T-3h"
const APPT_FIRED_KEY = "medifamily_appt_fired_v1"; // localStorage cache of fired appointment ids

interface StoredAppointment {
  id: string;
  member_name: string;
  doctor_name: string;
  hospital: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  reminder: boolean;
}

function loadFiredAppointmentIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(APPT_FIRED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveFiredAppointmentIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  // Cap to last 200 entries to keep localStorage small
  const arr = [...ids].slice(-200);
  localStorage.setItem(APPT_FIRED_KEY, JSON.stringify(arr));
}

function formatTime12h(timeStr: string): string {
  const [h, m] = timeStr.split(":");
  const hh = parseInt(h, 10);
  const ampm = hh >= 12 ? "PM" : "AM";
  return `${hh % 12 || 12}:${m} ${ampm}`;
}

/**
 * Hook that:
 * 1. Requests notification permission on first app load (if enabled in settings)
 * 2. Checks reminders every minute and fires browser notifications at the right time
 * 3. Respects quiet hours and notification toggle
 * 4. Listens for SW messages (e.g. "Taken" action from notification)
 */
export function useNotificationChecker() {
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const quietHoursEnabled = useSettingsStore((s) => s.quietHoursEnabled);
  const quietHoursStart = useSettingsStore((s) => s.quietHoursStart);
  const quietHoursEnd = useSettingsStore((s) => s.quietHoursEnd);
  const userId = useAuthStore((s) => s.user?.id);
  const firedRef = useRef<Set<string>>(new Set());
  const firedAppointmentsRef = useRef<Set<string>>(loadFiredAppointmentIds());

  // Handle "Taken" action from SW notification button
  const handleSWMessage = useCallback(async (event: MessageEvent) => {
    if (event.data?.type !== "REMINDER_ACTION") return;

    const { action, reminderId } = event.data;

    if (action === "taken" && reminderId) {
      try {
        const { db } = await import("@/lib/db/dexie");
        const { v4: uuidv4 } = await import("uuid");
        const now = new Date();

        await db.reminderLogs.add({
          id: uuidv4(),
          reminder_id: reminderId,
          scheduled_at: now.toISOString(),
          acted_at: now.toISOString(),
          status: "taken",
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          sync_status: "pending",
          is_deleted: false,
        });
      } catch (err) {
        console.error("Failed to log taken action:", err);
      }
    }
  }, []);

  // Listen for SW messages
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;

    navigator.serviceWorker.addEventListener("message", handleSWMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSWMessage);
    };
  }, [handleSWMessage]);

  // Request permission once on mount (if notifications are enabled)
  useEffect(() => {
    if (!notificationsEnabled) return;
    requestNotificationPermission();
  }, [notificationsEnabled]);

  // Check reminders every minute
  useEffect(() => {
    if (!notificationsEnabled) return;

    const isInQuietHours = (): boolean => {
      if (!quietHoursEnabled) return false;
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = quietHoursStart.split(":").map(Number);
      const [endH, endM] = quietHoursEnd.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      // Handle overnight quiet hours (e.g. 22:00 - 07:00)
      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    };

    const checkAppointments = () => {
      if (!userId) return;
      try {
        const raw = localStorage.getItem(`medifamily_appointments_${userId}`);
        if (!raw) return;
        const appts = JSON.parse(raw) as StoredAppointment[];
        if (!Array.isArray(appts) || appts.length === 0) return;

        const now = Date.now();
        for (const a of appts) {
          if (!a.reminder || !a.date || !a.time) continue;
          if (firedAppointmentsRef.current.has(a.id)) continue;

          const apptMs = new Date(`${a.date}T${a.time}`).getTime();
          if (Number.isNaN(apptMs)) continue;

          const targetMs = apptMs - APPT_LEAD_MS; // 3 hours before
          const diff = Math.abs(now - targetMs);

          // Fire if we're within ±1 minute of the T-3h mark
          // (matches our 60s check interval so we don't miss it)
          if (diff > APPT_WINDOW_MS) continue;

          firedAppointmentsRef.current.add(a.id);
          saveFiredAppointmentIds(firedAppointmentsRef.current);

          showAppointmentNotification(
            a.doctor_name,
            a.hospital,
            a.member_name,
            formatTime12h(a.time),
            a.id
          );
        }
      } catch (err) {
        console.error("Appointment check failed:", err);
      }
    };

    const checkReminders = async () => {
      if (isInQuietHours()) return;
      checkAppointments();

      try {
        const { db } = await import("@/lib/db/dexie");
        const reminders = await db.reminders
          .filter((r) => r.is_active && !r.is_deleted)
          .toArray();

        if (reminders.length === 0) return;

        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
        const dayMap = [
          "sun",
          "mon",
          "tue",
          "wed",
          "thu",
          "fri",
          "sat",
        ] as const;
        const today = dayMap[now.getDay()];
        const todayDate = now.toISOString().split("T")[0];

        for (const reminder of reminders) {
          // Check if today is a scheduled day
          if (!reminder.days.includes(today)) continue;

          // Check if it's time (within 1-minute window)
          if (reminder.time !== currentTime) continue;

          // Check if already fired for this reminder+date combo
          const firedKey = `${reminder.id}_${todayDate}_${reminder.time}`;
          if (firedRef.current.has(firedKey)) continue;

          // Check if already logged (taken/skipped) today for this reminder
          const logs = await db.reminderLogs
            .filter(
              (l) =>
                l.reminder_id === reminder.id &&
                l.scheduled_at.startsWith(todayDate)
            )
            .toArray();

          if (logs.length > 0) continue;

          // Fire notification via Service Worker
          firedRef.current.add(firedKey);
          showReminderNotification(
            reminder.medicine_name,
            reminder.member_name || "",
            reminder.dosage,
            reminder.before_food,
            reminder.id
          );
        }
      } catch (err) {
        console.error("Notification check failed:", err);
      }
    };

    // Run immediately + every minute
    checkReminders();
    const interval = setInterval(checkReminders, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [
    notificationsEnabled,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    userId,
  ]);
}
