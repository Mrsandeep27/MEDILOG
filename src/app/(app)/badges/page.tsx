"use client";

import { useState, useEffect } from "react";
import {
  Award,
  Star,
  ScanLine,
  Users,
  FileText,
  Flame,
  Shield,
  Heart,
  Pill,
  Calendar,
  Trophy,
  Zap,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppHeader } from "@/components/layout/app-header";
import { useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
import { useReminders } from "@/hooks/use-reminders";
import { useAuthStore } from "@/stores/auth-store";
import type { ReminderLog } from "@/lib/db/schema";

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: typeof Award;
  color: string;
  bg: string;
  check: (ctx: BadgeContext) => boolean;
}

interface BadgeContext {
  membersCount: number;
  recordsCount: number;
  remindersCount: number;
  streak: number;
  hasAbha: boolean;
  scansCount: number;
  symptomsCount: number;
  logsCount: number;
}

function getStreak(logs: ReminderLog[]): number {
  if (logs.length === 0) return 0;
  const byDate = new Map<string, { taken: number; total: number }>();
  logs.forEach((l) => {
    const date = l.scheduled_at.split("T")[0];
    const existing = byDate.get(date) || { taken: 0, total: 0 };
    existing.total++;
    if (l.status === "taken") existing.taken++;
    byDate.set(date, existing);
  });
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const day = byDate.get(dateStr);
    if (!day) { if (i === 0) continue; break; }
    if (day.taken === day.total) streak++;
    else break;
  }
  return streak;
}

const BADGES: BadgeDef[] = [
  {
    id: "first-scan",
    name: "First Scan",
    description: "Scan your first prescription",
    icon: ScanLine,
    color: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-900",
    check: (ctx) => ctx.scansCount >= 1,
  },
  {
    id: "record-keeper",
    name: "Record Keeper",
    description: "Add 5 health records",
    icon: FileText,
    color: "text-emerald-600",
    bg: "bg-emerald-100 dark:bg-emerald-900",
    check: (ctx) => ctx.recordsCount >= 5,
  },
  {
    id: "family-protector",
    name: "Family Protector",
    description: "Add 3+ family members",
    icon: Users,
    color: "text-purple-600",
    bg: "bg-purple-100 dark:bg-purple-900",
    check: (ctx) => ctx.membersCount >= 3,
  },
  {
    id: "streak-3",
    name: "3-Day Streak",
    description: "Take all medicines for 3 days straight",
    icon: Flame,
    color: "text-orange-600",
    bg: "bg-orange-100 dark:bg-orange-900",
    check: (ctx) => ctx.streak >= 3,
  },
  {
    id: "streak-7",
    name: "7-Day Warrior",
    description: "Take all medicines for 7 days straight",
    icon: Award,
    color: "text-amber-600",
    bg: "bg-amber-100 dark:bg-amber-900",
    check: (ctx) => ctx.streak >= 7,
  },
  {
    id: "streak-30",
    name: "Monthly Champion",
    description: "30-day medicine streak!",
    icon: Trophy,
    color: "text-yellow-600",
    bg: "bg-yellow-100 dark:bg-yellow-900",
    check: (ctx) => ctx.streak >= 30,
  },
  {
    id: "abha-linked",
    name: "Digital Health",
    description: "Link your ABHA Health ID",
    icon: Shield,
    color: "text-green-600",
    bg: "bg-green-100 dark:bg-green-900",
    check: (ctx) => ctx.hasAbha,
  },
  {
    id: "symptom-tracker",
    name: "Health Logger",
    description: "Log symptoms for 7 days",
    icon: Heart,
    color: "text-pink-600",
    bg: "bg-pink-100 dark:bg-pink-900",
    check: (ctx) => ctx.symptomsCount >= 7,
  },
  {
    id: "pill-master",
    name: "Pill Master",
    description: "Set up 5+ reminders",
    icon: Pill,
    color: "text-indigo-600",
    bg: "bg-indigo-100 dark:bg-indigo-900",
    check: (ctx) => ctx.remindersCount >= 5,
  },
  {
    id: "record-10",
    name: "Digital Archive",
    description: "Add 10 health records",
    icon: Star,
    color: "text-cyan-600",
    bg: "bg-cyan-100 dark:bg-cyan-900",
    check: (ctx) => ctx.recordsCount >= 10,
  },
  {
    id: "consistent",
    name: "Consistent",
    description: "Log 50+ medicine actions",
    icon: Zap,
    color: "text-violet-600",
    bg: "bg-violet-100 dark:bg-violet-900",
    check: (ctx) => ctx.logsCount >= 50,
  },
  {
    id: "record-25",
    name: "Health Historian",
    description: "Add 25 health records",
    icon: Calendar,
    color: "text-teal-600",
    bg: "bg-teal-100 dark:bg-teal-900",
    check: (ctx) => ctx.recordsCount >= 25,
  },
];

export default function BadgesPage() {
  const user = useAuthStore((s) => s.user);
  const { members } = useMembers();
  const { records } = useRecords();
  const { reminders } = useReminders();
  const [ctx, setCtx] = useState<BadgeContext | null>(null);

  const selfMember = members.find((m) => m.relation === "self");

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { db } = await import("@/lib/db/dexie");
      const logs = await db.reminderLogs.toArray();
      const streak = getStreak(logs);

      const sympRaw = localStorage.getItem(`medilog_symptoms_${user.id}`);
      const symptoms = sympRaw ? JSON.parse(sympRaw) : [];

      const scans = records.filter((r) => r.raw_ocr_text || r.ai_extracted);

      setCtx({
        membersCount: members.length,
        recordsCount: records.length,
        remindersCount: reminders.length,
        streak,
        hasAbha: !!(selfMember?.abha_number),
        scansCount: scans.length,
        symptomsCount: symptoms.length,
        logsCount: logs.length,
      });
    }
    load();
  }, [user, members, records, reminders, selfMember]);

  const earned = ctx ? BADGES.filter((b) => b.check(ctx)) : [];
  const locked = ctx ? BADGES.filter((b) => !b.check(ctx)) : BADGES;

  return (
    <div>
      <AppHeader title="Health Badges" showBack />
      <div className="p-4 space-y-4">
        {/* Summary */}
        <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border-amber-200 dark:border-amber-800">
          <CardContent className="py-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{earned.length}/{BADGES.length}</div>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">Badges Earned</p>
          </CardContent>
        </Card>

        {/* Earned Badges */}
        {earned.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Earned ({earned.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {earned.map((badge) => {
                const Icon = badge.icon;
                return (
                  <Card key={badge.id} className="border-amber-200 dark:border-amber-800">
                    <CardContent className="py-3 text-center">
                      <div className={`h-12 w-12 rounded-full ${badge.bg} flex items-center justify-center mx-auto mb-2`}>
                        <Icon className={`h-6 w-6 ${badge.color}`} />
                      </div>
                      <p className="text-xs font-bold">{badge.name}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{badge.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Locked Badges */}
        {locked.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Locked ({locked.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {locked.map((badge) => {
                const Icon = badge.icon;
                return (
                  <Card key={badge.id} className="opacity-50">
                    <CardContent className="py-3 text-center">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-bold text-muted-foreground">{badge.name}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{badge.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
