"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, FileText, Pill, HeartPulse, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useRecords } from "@/hooks/use-records";

interface WeeklyStats {
  recordsAdded: number;
  adherencePercent: number;
  symptomsLogged: number;
  appointments: number;
}

export function WeeklySummary() {
  const user = useAuthStore((s) => s.user);
  const { records } = useRecords();
  const [stats, setStats] = useState<WeeklyStats | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString();

      // Records added this week
      const weekRecords = records.filter((r) => r.created_at >= weekAgoStr);

      // Adherence
      let adherencePercent = 0;
      try {
        const { db } = await import("@/lib/db/dexie");
        const logs = await db.reminderLogs
          .filter((l) => l.scheduled_at >= weekAgoStr)
          .toArray();
        const taken = logs.filter((l) => l.status === "taken").length;
        adherencePercent = logs.length > 0 ? Math.round((taken / logs.length) * 100) : 0;
      } catch { /* ignore */ }

      // Symptoms logged
      let symptomsLogged = 0;
      try {
        const raw = localStorage.getItem(`medilog_symptoms_${user.id}`);
        if (raw) {
          const entries = JSON.parse(raw);
          symptomsLogged = entries.filter(
            (e: { date: string }) => new Date(e.date) >= weekAgo
          ).length;
        }
      } catch { /* ignore */ }

      // Appointments
      let appointmentCount = 0;
      try {
        const raw = localStorage.getItem(`medilog_appointments_${user.id}`);
        if (raw) {
          const apts = JSON.parse(raw);
          const weekFromNow = new Date();
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          appointmentCount = apts.filter(
            (a: { date: string }) => {
              const d = new Date(a.date);
              return d >= new Date() && d <= weekFromNow;
            }
          ).length;
        }
      } catch { /* ignore */ }

      setStats({
        recordsAdded: weekRecords.length,
        adherencePercent,
        symptomsLogged,
        appointments: appointmentCount,
      });
    }
    load();
  }, [user, records]);

  if (!stats) return null;

  // Only show if there's any activity
  if (stats.recordsAdded === 0 && stats.adherencePercent === 0 && stats.symptomsLogged === 0 && stats.appointments === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="py-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold">This Week</h3>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Link href="/records" className="text-center">
            <FileText className="h-4 w-4 mx-auto text-muted-foreground mb-0.5" />
            <div className="text-sm font-bold">{stats.recordsAdded}</div>
            <p className="text-[9px] text-muted-foreground">Records</p>
          </Link>
          <Link href="/reminders" className="text-center">
            <Pill className="h-4 w-4 mx-auto text-muted-foreground mb-0.5" />
            <div className="text-sm font-bold">{stats.adherencePercent}%</div>
            <p className="text-[9px] text-muted-foreground">Adherence</p>
          </Link>
          <Link href="/symptom-tracker" className="text-center">
            <HeartPulse className="h-4 w-4 mx-auto text-muted-foreground mb-0.5" />
            <div className="text-sm font-bold">{stats.symptomsLogged}</div>
            <p className="text-[9px] text-muted-foreground">Logs</p>
          </Link>
          <Link href="/appointments" className="text-center">
            <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-0.5" />
            <div className="text-sm font-bold">{stats.appointments}</div>
            <p className="text-[9px] text-muted-foreground">Upcoming</p>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
