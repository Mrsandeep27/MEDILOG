"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  FileText,
  Pill,
  TestTube,
  Stethoscope,
  Menu,
  ScanLine,
  Plus,
  AlertTriangle,
  HeartPulse,
  FileDown,
  Users,
  Share2,
  Download,
  Settings,
  MessageSquare,
  X,
  Smile,
  Meh,
  Frown,
  AlertCircle,
  Shield,
  Calendar,
  TrendingUp,
  Award,
  Clock,
  CheckCircle,
  Lightbulb,
  Search,
  CalendarDays,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MemberSelector } from "@/components/family/member-selector";
import { RecordCard } from "@/components/records/record-card";
import { GlobalSearch } from "@/components/home/global-search";
import { NotificationCenter } from "@/components/home/notification-center";
import { WeeklySummary } from "@/components/home/weekly-summary";
import { useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
import { useReminders } from "@/hooks/use-reminders";
import { useAuthStore } from "@/stores/auth-store";
import { useFamilyStore } from "@/stores/family-store";
import { APP_NAME } from "@/constants/config";
import { PWAInstallBanner } from "@/components/pwa/install-button";

const moodOptions = [
  { value: "great", icon: Smile, label: "Great", color: "text-green-500", bg: "bg-green-500/20" },
  { value: "good", icon: Smile, label: "Good", color: "text-emerald-500", bg: "bg-emerald-500/20" },
  { value: "okay", icon: Meh, label: "Okay", color: "text-yellow-500", bg: "bg-yellow-500/20" },
  { value: "bad", icon: Frown, label: "Bad", color: "text-orange-500", bg: "bg-orange-500/20" },
  { value: "terrible", icon: AlertCircle, label: "Terrible", color: "text-red-500", bg: "bg-red-500/20" },
];

const quickActions = [
  { href: "/scan", icon: ScanLine, label: "Scan Rx", gradient: "from-blue-500 to-blue-600" },
  { href: "/records/add", icon: Plus, label: "Add Record", gradient: "from-emerald-500 to-emerald-600" },
  { href: "/symptom-tracker", icon: HeartPulse, label: "Symptoms", gradient: "from-pink-500 to-pink-600" },
  { href: "/reminders", icon: Bell, label: "Reminders", gradient: "from-amber-500 to-amber-600" },
];

const shortcutItems = [
  { href: "/scan", icon: ScanLine, label: "Scan Prescription" },
  { href: "/records/add", icon: Plus, label: "Add Record" },
  { href: "/symptom-tracker", icon: HeartPulse, label: "Log Symptoms" },
  { href: "/reminders", icon: Bell, label: "Reminders" },
  { href: "/timeline", icon: Clock, label: "Health Timeline" },
  { href: "/appointments", icon: CalendarDays, label: "Appointments" },
  { href: "/emergency-card", icon: AlertTriangle, label: "Emergency Card" },
  { href: "/medicine-checker", icon: Zap, label: "Medicine Checker" },
  { href: "/vitals", icon: Activity, label: "Vitals Tracker" },
  { href: "/smart-records", icon: Activity, label: "Health Overview" },
  { href: "/health-risk", icon: AlertTriangle, label: "Risk Assessment" },
  { href: "/more/export", icon: Download, label: "Download Report" },
  { href: "/more/shared-links", icon: Share2, label: "Share with Doctor" },
  { href: "/abha", icon: Shield, label: "ABHA Health ID" },
  { href: "/more/settings", icon: Settings, label: "Settings" },
  { href: "/more/feedback", icon: MessageSquare, label: "Feedback" },
];

const healthTips = [
  "Drink at least 8 glasses of water daily to stay hydrated.",
  "Take a 10-minute walk after every meal to aid digestion.",
  "Get 7-8 hours of sleep every night for optimal health.",
  "Eat seasonal fruits daily — they boost immunity naturally.",
  "Practice deep breathing for 5 minutes to reduce stress.",
  "Wash hands frequently to prevent infections.",
  "Schedule regular health checkups — prevention is better than cure.",
  "Reduce screen time before bed for better sleep quality.",
  "Include leafy greens in at least one meal every day.",
  "Take medicine at the same time daily for best results.",
];

function getAdherenceStats(logs: Array<{ status: string; scheduled_at: string }>) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekLogs = logs.filter((l) => new Date(l.scheduled_at) >= weekAgo);
  const taken = weekLogs.filter((l) => l.status === "taken").length;
  const total = weekLogs.length;
  return { taken, total, percentage: total > 0 ? Math.round((taken / total) * 100) : 0 };
}

function getStreak(logs: Array<{ status: string; scheduled_at: string }>) {
  if (logs.length === 0) return 0;
  const byDate = new Map<string, boolean>();
  logs.forEach((l) => {
    const date = l.scheduled_at.split("T")[0];
    if (l.status === "taken") byDate.set(date, true);
    else if (!byDate.has(date)) byDate.set(date, false);
  });
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (byDate.get(dateStr) === true) streak++;
    else if (byDate.has(dateStr)) break;
    else if (i === 0) continue; // skip today if no logs yet
    else break;
  }
  return streak;
}

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { members } = useMembers();
  const { selectedMemberId, setSelectedMember } = useFamilyStore();
  const { records } = useRecords(selectedMemberId || undefined);
  const { reminders, todayReminders } = useReminders();
  const [showMenu, setShowMenu] = useState(false);
  const [showFeeling, setShowFeeling] = useState(false);
  const [reminderLogs, setReminderLogs] = useState<Array<{ status: string; scheduled_at: string }>>([]);
  const [appointments, setAppointments] = useState<Array<{ date: string; time: string; doctor_name: string; purpose: string }>>([]);
  const [tip] = useState(() => healthTips[Math.floor(Math.random() * healthTips.length)]);

  const selfMember = members.find((m) => m.relation === "self");
  const greeting = selfMember
    ? `Hi, ${selfMember.name.split(" ")[0]}`
    : "Welcome";
  const recentRecords = records.slice(0, 3);

  // Load reminder logs for adherence
  useEffect(() => {
    import("@/lib/db/dexie").then(({ db }) => {
      db.reminderLogs.toArray().then(setReminderLogs);
    });
  }, []);

  // Load upcoming appointments
  useEffect(() => {
    if (!user) return;
    const raw = localStorage.getItem(`medilog_appointments_${user.id}`);
    if (raw) {
      try {
        const all = JSON.parse(raw);
        const today = new Date().toISOString().split("T")[0];
        const upcoming = all
          .filter((a: { date: string }) => a.date >= today)
          .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))
          .slice(0, 3);
        setAppointments(upcoming);
      } catch { /* ignore */ }
    }
  }, [user]);

  const adherence = getAdherenceStats(reminderLogs);
  const streak = getStreak(reminderLogs);

  // Show "Feeling Today" popup once per day
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const lastShown = localStorage.getItem("medilog_feeling_shown");
    if (lastShown !== today) {
      const timer = setTimeout(() => setShowFeeling(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleFeelingSelect = (mood: string) => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("medilog_feeling_shown", today);
    const userId = user?.id || "anon";
    const key = `medilog_symptoms_${userId}`;
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const entry = {
      id: Date.now().toString(),
      date: today,
      mood,
      symptoms: [],
      notes: "",
      timestamp: Date.now(),
    };
    const updated = [entry, ...existing.filter((e: { date: string }) => e.date !== today)];
    localStorage.setItem(key, JSON.stringify(updated));
    setShowFeeling(false);
    if (mood === "bad" || mood === "terrible") {
      router.push("/symptom-tracker");
    }
  };

  const dismissFeeling = () => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("medilog_feeling_shown", today);
    setShowFeeling(false);
  };

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-6">
      <PWAInstallBanner />

      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="MediLog"
              width={36}
              height={36}
              className="rounded-lg bg-white p-0.5"
            />
            <div>
              <p className="text-primary-foreground/70 text-xs">{timeGreeting}</p>
              <h1 className="text-xl font-bold">{greeting}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMenu(true)}
              className="h-10 w-10 rounded-full hover:bg-primary-foreground/10 flex items-center justify-center"
            >
              <Menu className="h-5 w-5" />
            </button>
            <NotificationCenter />
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <GlobalSearch />
        </div>

        {/* 3 Main AI Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/ai-doctor">
            <div className="flex flex-col items-center gap-2 bg-primary-foreground/10 rounded-2xl p-4 hover:bg-primary-foreground/20 transition-colors">
              <Stethoscope className="h-7 w-7" />
              <span className="text-xs font-medium">AI Doctor</span>
            </div>
          </Link>
          <Link href="/medicine">
            <div className="flex flex-col items-center gap-2 bg-primary-foreground/10 rounded-2xl p-4 hover:bg-primary-foreground/20 transition-colors">
              <Pill className="h-7 w-7" />
              <span className="text-xs font-medium">Medicine Info</span>
            </div>
          </Link>
          <Link href="/lab-insights">
            <div className="flex flex-col items-center gap-2 bg-primary-foreground/10 rounded-2xl p-4 hover:bg-primary-foreground/20 transition-colors">
              <TestTube className="h-7 w-7" />
              <span className="text-xs font-medium">Lab Insights</span>
            </div>
          </Link>
        </div>
      </div>

      <div className="px-4 space-y-5">
        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <div className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-gradient-to-br ${action.gradient} text-white hover:opacity-90 transition-opacity`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{action.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Weekly Summary */}
        <WeeklySummary />

        {/* Today's Medicines */}
        {(todayReminders?.length ?? 0) > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Pill className="h-4 w-4 text-primary" />
                Today&apos;s Medicines
              </h2>
              <Link href="/reminders" className="text-xs text-primary font-medium">
                View All
              </Link>
            </div>
            <div className="space-y-2">
              {todayReminders?.slice(0, 3).map((r) => (
                <Card key={r.id}>
                  <CardContent className="py-2.5 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.medicine_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.time} · {r.dosage || ""} · {r.before_food ? "Before food" : "After food"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{r.member_name}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Health Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          {/* Adherence */}
          <Link href="/reminders">
            <Card className="hover:bg-muted/30 transition-colors">
              <CardContent className="py-3 text-center">
                <div className="text-lg font-bold text-primary">{adherence.percentage}%</div>
                <p className="text-[10px] text-muted-foreground">Adherence</p>
              </CardContent>
            </Card>
          </Link>
          {/* Streak */}
          <Link href="/reminders">
            <Card className="hover:bg-muted/30 transition-colors">
              <CardContent className="py-3 text-center">
                <div className="text-lg font-bold text-amber-500 flex items-center justify-center gap-1">
                  {streak}<Award className="h-4 w-4" />
                </div>
                <p className="text-[10px] text-muted-foreground">Day Streak</p>
              </CardContent>
            </Card>
          </Link>
          {/* Records Count */}
          <Link href="/records">
            <Card className="hover:bg-muted/30 transition-colors">
              <CardContent className="py-3 text-center">
                <div className="text-lg font-bold text-emerald-500">{records.length}</div>
                <p className="text-[10px] text-muted-foreground">Records</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ABHA Banner */}
        <Link href="/abha">
          {selfMember?.abha_number ? (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">ABHA Linked</p>
                <p className="text-xs text-green-600 dark:text-green-400 truncate">
                  {selfMember.abha_address || selfMember.abha_number}
                </p>
              </div>
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">View &rarr;</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 dark:border-green-800">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-green-800 dark:text-green-200">Link ABHA Health ID</p>
                <p className="text-xs text-green-600 dark:text-green-400">Govt. of India digital health ID</p>
              </div>
            </div>
          )}
        </Link>

        {/* Upcoming Appointments */}
        {appointments.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                Upcoming Appointments
              </h2>
              <Link href="/appointments" className="text-xs text-primary font-medium">
                View All
              </Link>
            </div>
            <div className="space-y-2">
              {appointments.map((apt, i) => (
                <Card key={i}>
                  <CardContent className="py-2.5 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                      <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{apt.doctor_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(apt.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {apt.time}
                        {apt.purpose ? ` · ${apt.purpose}` : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Health Tip */}
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardContent className="py-3 flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Health Tip</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">{tip}</p>
            </div>
          </CardContent>
        </Card>

        {/* Family Members */}
        {members.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Family Members</h2>
              <Link href="/family" className="text-xs text-primary font-medium">
                View All
              </Link>
            </div>
            <MemberSelector
              members={members}
              selectedId={selectedMemberId}
              onSelect={(m) => setSelectedMember(m.id)}
            />
          </section>
        )}

        {/* Recent Records */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Recent Records
            </h2>
            {records.length > 0 && (
              <Link href="/records" className="text-xs text-primary font-medium">
                View All
              </Link>
            )}
          </div>
          {recentRecords.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No records yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Scan a prescription or add a record to get started
                </p>
                <div className="flex gap-2 justify-center mt-3">
                  <Link href="/scan">
                    <Button size="sm" variant="default">
                      <ScanLine className="h-4 w-4 mr-1" />
                      Scan
                    </Button>
                  </Link>
                  <Link href="/records/add">
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentRecords.map((record) => (
                <RecordCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* === SHORTCUTS MENU === */}
      {showMenu && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-primary text-primary-foreground">
              <div>
                <h3 className="font-bold text-lg">All Features</h3>
                <p className="text-xs text-primary-foreground/70">Quick access to everything</p>
              </div>
              <button onClick={() => setShowMenu(false)} className="h-9 w-9 rounded-full bg-primary-foreground/10 flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 80px)" }}>
              {selfMember && (
                <Link
                  href="/emergency-card"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
                >
                  <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-red-700 dark:text-red-400">Emergency Card</span>
                    <p className="text-[10px] text-red-500 dark:text-red-400">Blood group, allergies, contacts</p>
                  </div>
                </Link>
              )}
              {shortcutItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-muted transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* === FEELING TODAY POPUP === */}
      {showFeeling && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={dismissFeeling} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">How are you feeling today?</h3>
              <button onClick={dismissFeeling} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-between">
              {moodOptions.map((mood) => {
                const Icon = mood.icon;
                return (
                  <button
                    key={mood.value}
                    onClick={() => handleFeelingSelect(mood.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl hover:${mood.bg} transition-all active:scale-95`}
                  >
                    <Icon className={`h-9 w-9 ${mood.color}`} />
                    <span className="text-[11px] font-medium">{mood.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={dismissFeeling}
              className="text-xs text-muted-foreground text-center w-full"
            >
              Skip for today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
