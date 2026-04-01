"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (!user) return;
    buildNotifications();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const raw = localStorage.getItem(`medilog_appointments_${user.id}`);
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
    const sympKey = `medilog_symptoms_${user.id}`;
    const sympRaw = localStorage.getItem(sympKey);
    const symptoms = sympRaw ? JSON.parse(sympRaw) : [];
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
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative h-10 w-10 rounded-full hover:bg-primary-foreground/10 flex items-center justify-center"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 h-4 w-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-lg">Notifications</h3>
              <button onClick={() => setOpen(false)} className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 70px)" }}>
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground">No pending notifications</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const Icon = iconMap[notif.type];
                  return (
                    <Link
                      key={notif.id}
                      href={notif.href}
                      onClick={() => {
                        markRead(notif.id);
                        setOpen(false);
                      }}
                    >
                      <div className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                        notif.read ? "opacity-60" : bgMap[notif.type]
                      }`}>
                        <div className={`h-9 w-9 rounded-full bg-white dark:bg-background flex items-center justify-center shrink-0 ${
                          notif.read ? "" : "shadow-sm"
                        }`}>
                          <Icon className={`h-4 w-4 ${colorMap[notif.type]}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{notif.title}</p>
                          <p className="text-xs text-muted-foreground">{notif.message}</p>
                        </div>
                        {!notif.read && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
