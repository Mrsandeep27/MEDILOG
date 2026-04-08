"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  X,
  Pill,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

interface Notification {
  id: string;
  type: "reminder" | "appointment" | "record" | "alert";
  title: string;
  message: string;
  href: string;
  timestamp: number;
  read: boolean;
}

const iconMap = {
  reminder: Pill,
  appointment: Calendar,
  record: FileText,
  alert: AlertTriangle,
};

const bgMap = {
  reminder: "bg-blue-50 dark:bg-blue-950",
  appointment: "bg-purple-50 dark:bg-purple-950",
  record: "bg-green-50 dark:bg-green-950",
  alert: "bg-red-50 dark:bg-red-950",
};

const colorMap = {
  reminder: "text-blue-600 dark:text-blue-400",
  appointment: "text-purple-600 dark:text-purple-400",
  record: "text-green-600 dark:text-green-400",
  alert: "text-red-600 dark:text-red-400",
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const user = useAuthStore((s) => s.user);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    buildNotifications();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function buildNotifications() {
    if (!user) return;
    const notifs: Notification[] = [];

    // Check missed reminders (from today's logs)
    try {
      const { db } = await import("@/lib/db/dexie");
      const today = new Date().toISOString().split("T")[0];
      const todayLogs = await db.reminderLogs
        .filter((l) => l.scheduled_at.startsWith(today) && l.status === "missed")
        .toArray();
      if (todayLogs.length > 0) {
        notifs.push({
          id: "missed-meds",
          type: "reminder",
          title: "Missed Medicines",
          message: `You missed ${todayLogs.length} medicine${todayLogs.length > 1 ? "s" : ""} today`,
          href: "/reminders",
          timestamp: Date.now(),
          read: false,
        });
      }

      // Check reminders due now
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      const dueReminders = await db.reminders
        .filter((r) => !r.is_deleted && r.is_active && r.time <= currentTime)
        .toArray();
      if (dueReminders.length > 0) {
        notifs.push({
          id: "due-meds",
          type: "reminder",
          title: "Medicines Due",
          message: `${dueReminders.length} medicine${dueReminders.length > 1 ? "s" : ""} due now`,
          href: "/reminders",
          timestamp: Date.now(),
          read: false,
        });
      }
    } catch { /* ignore DB errors */ }

    // Check upcoming appointments
    try {
      const raw = localStorage.getItem(`medifamily_appointments_${user.id}`);
      if (raw) {
        const appointments = JSON.parse(raw);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];
        const upcoming = appointments.filter(
          (a: { date: string }) => a.date === tomorrowStr
        );
        if (upcoming.length > 0) {
          notifs.push({
            id: "upcoming-apt",
            type: "appointment",
            title: "Appointment Tomorrow",
            message: `Dr. ${upcoming[0].doctor_name}${upcoming.length > 1 ? ` and ${upcoming.length - 1} more` : ""}`,
            href: "/appointments",
            timestamp: Date.now(),
            read: false,
          });
        }
      }
    } catch { /* ignore */ }

    // Check if symptom logging is pending today
    const today = new Date().toISOString().split("T")[0];
    const sympKey = `medifamily_symptoms_${user.id}`;
    const sympRaw = localStorage.getItem(sympKey);
    let symptoms: Array<{ date: string }> = [];
    try { symptoms = sympRaw ? JSON.parse(sympRaw) : []; } catch { /* ignore */ }
    const todayEntry = symptoms.find((e: { date: string }) => e.date === today);
    if (!todayEntry) {
      notifs.push({
        id: "log-symptoms",
        type: "alert",
        title: "Log Your Symptoms",
        message: "You haven't logged how you're feeling today",
        href: "/symptom-tracker",
        timestamp: Date.now(),
        read: false,
      });
    }

    setNotifications(notifs);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-10 w-10 rounded-full hover:bg-primary-foreground/10 flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 h-4 w-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-background text-foreground shadow-xl ring-1 ring-black/5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Compact header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center -mr-1"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body — auto height, capped */}
          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 px-4">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-1.5" />
                <p className="text-sm font-medium">All caught up</p>
                <p className="text-[11px] text-muted-foreground">No pending notifications</p>
              </div>
            ) : (
              <ul className="py-1">
                {notifications.map((notif) => {
                  const Icon = iconMap[notif.type];
                  return (
                    <li key={notif.id}>
                      <Link
                        href={notif.href}
                        onClick={() => {
                          markRead(notif.id);
                          setOpen(false);
                        }}
                        className={`flex items-start gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors ${
                          notif.read ? "opacity-60" : ""
                        }`}
                      >
                        <div className={`h-8 w-8 rounded-full ${bgMap[notif.type]} flex items-center justify-center shrink-0 mt-0.5`}>
                          <Icon className={`h-3.5 w-3.5 ${colorMap[notif.type]}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium leading-snug truncate">{notif.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-snug truncate">{notif.message}</p>
                        </div>
                        {!notif.read && (
                          <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-2" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
