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
  ScanLine,
  Plus,
  AlertTriangle,
  HeartPulse,
  X,
  Smile,
  Meh,
  Frown,
  AlertCircle,
  Shield,
  Calendar,
  Clock,
  Lightbulb,
  CalendarDays,
  Zap,
  LayoutGrid,
  ChevronDown,
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
import { useAuthStore } from "@/stores/auth-store";
import { useFamilyStore } from "@/stores/family-store";
import { APP_NAME } from "@/constants/config";
import { PWAInstallBanner } from "@/components/pwa/install-button";
import { useLocale } from "@/lib/i18n/use-locale";

const moodOptionDefs = [
  { value: "great", icon: Smile, labelKey: "mood.great", color: "text-green-500", bg: "bg-green-500/20" },
  { value: "good", icon: Smile, labelKey: "mood.good", color: "text-emerald-500", bg: "bg-emerald-500/20" },
  { value: "okay", icon: Meh, labelKey: "mood.okay", color: "text-yellow-500", bg: "bg-yellow-500/20" },
  { value: "bad", icon: Frown, labelKey: "mood.bad", color: "text-orange-500", bg: "bg-orange-500/20" },
  { value: "terrible", icon: AlertCircle, labelKey: "mood.terrible", color: "text-red-500", bg: "bg-red-500/20" },
];

const quickActionDefs = [
  { href: "/scan", icon: ScanLine, labelKey: "home.scan_rx", gradient: "from-blue-500 to-blue-600" },
  { href: "/records/add", icon: Plus, labelKey: "home.add_record", gradient: "from-emerald-500 to-emerald-600" },
  { href: "/symptom-tracker", icon: HeartPulse, labelKey: "home.symptoms", gradient: "from-pink-500 to-pink-600" },
  { href: "/reminders", icon: Bell, labelKey: "home.reminders", gradient: "from-amber-500 to-amber-600" },
];

// Specialized health tools — basic actions (Scan/Add/Symptoms/Reminders) live
// in the quick actions row, and Settings/Feedback/Export live under /more.
const shortcutDefs = [
  { href: "/medicine-checker", icon: Zap, labelKey: "more.medicine_checker" },
  { href: "/vitals", icon: Activity, labelKey: "home.vitals_tracker" },
  { href: "/smart-records", icon: Activity, labelKey: "home.health_overview" },
  { href: "/health-risk", icon: AlertTriangle, labelKey: "home.risk_assessment" },
  { href: "/timeline", icon: Clock, labelKey: "home.health_timeline" },
  { href: "/appointments", icon: CalendarDays, labelKey: "more.appointments" },
  { href: "/abha", icon: Shield, labelKey: "home.abha_health_id" },
];

const tipKeys = ["tip.1", "tip.2", "tip.3", "tip.4", "tip.5", "tip.6", "tip.7", "tip.8", "tip.9", "tip.10"];

export default function HomePage() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const user = useAuthStore((s) => s.user);
  const { members } = useMembers();
  const { selectedMemberId, setSelectedMember } = useFamilyStore();
  const { records } = useRecords(selectedMemberId || undefined);
  const [showFeeling, setShowFeeling] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [appointments, setAppointments] = useState<Array<{ date: string; time: string; doctor_name: string; purpose: string }>>([]);
  // Rotate tip on every mount (each time user lands on home) — pick a fresh
  // random key so revisiting feels alive instead of stuck on one tip.
  const [tipKey, setTipKey] = useState(() => tipKeys[Math.floor(Math.random() * tipKeys.length)]);
  useEffect(() => {
    setTipKey(tipKeys[Math.floor(Math.random() * tipKeys.length)]);
  }, []);

  const selfMember = members.find((m) => m.relation === "self");
  const greeting = selfMember
    ? `${t("home.greeting")}, ${selfMember.name.split(" ")[0]}`
    : t("home.welcome");
  const recentRecords = records.slice(0, 3);

  // Load upcoming appointments
  useEffect(() => {
    if (!user) return;
    const raw = localStorage.getItem(`medifamily_appointments_${user.id}`);
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

  // Show "Feeling Today" popup once per day
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const lastShown = localStorage.getItem("medifamily_feeling_shown");
    if (lastShown !== today) {
      const timer = setTimeout(() => setShowFeeling(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleFeelingSelect = (mood: string) => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("medifamily_feeling_shown", today);
    const userId = user?.id || "anon";
    const key = `medifamily_symptoms_${userId}`;
    let existing: Array<{ date: string }> = [];
    try { existing = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* corrupted data */ }
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
    localStorage.setItem("medifamily_feeling_shown", today);
    setShowFeeling(false);
  };

  const hour = new Date().getHours();
  const timeGreeting =
    hour >= 5 && hour < 12
      ? t("home.good_morning")
      : hour >= 12 && hour < 17
        ? t("home.good_afternoon")
        : hour >= 17 && hour < 21
          ? t("home.good_evening")
          : t("home.good_night");

  return (
    <div className="space-y-6">
      <PWAInstallBanner />

      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="MediFamily"
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
              <span className="text-xs font-medium">{t("home.ai_doctor")}</span>
            </div>
          </Link>
          <Link href="/medicine">
            <div className="flex flex-col items-center gap-2 bg-primary-foreground/10 rounded-2xl p-4 hover:bg-primary-foreground/20 transition-colors">
              <Pill className="h-7 w-7" />
              <span className="text-xs font-medium">{t("home.medicine_info")}</span>
            </div>
          </Link>
          <Link href="/lab-insights">
            <div className="flex flex-col items-center gap-2 bg-primary-foreground/10 rounded-2xl p-4 hover:bg-primary-foreground/20 transition-colors">
              <TestTube className="h-7 w-7" />
              <span className="text-xs font-medium">{t("home.lab_insights")}</span>
            </div>
          </Link>
        </div>
      </div>

      <div className="px-4 space-y-5">
        {/* Health Tip — compact icon strip, rotates each visit */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-amber-50 border border-amber-200">
          <Lightbulb className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800 truncate">{t(tipKey)}</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          {quickActionDefs.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <div className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-gradient-to-br ${action.gradient} text-white hover:opacity-90 transition-opacity`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{t(action.labelKey)}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* All Tools — expandable */}
        <section>
          <button
            type="button"
            onClick={() => setShowTools((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-muted/50 hover:bg-muted transition-colors"
            aria-expanded={showTools}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <LayoutGrid className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">{t("home.all_features")}</p>
                <p className="text-[11px] text-muted-foreground">{showTools ? t("home.tap_to_collapse") : t("home.tap_to_expand")}</p>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showTools ? "rotate-180" : ""}`} />
          </button>

          {showTools && (
            <div className="mt-3 grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {selfMember && (
                <Link
                  href="/emergency-card"
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-red-50 border border-red-200"
                >
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-[10px] font-medium text-center text-red-700 leading-tight">{t("home.emergency_card")}</span>
                </Link>
              )}
              {shortcutDefs.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/40 hover:bg-muted transition-colors"
                  >
                    <Icon className="h-5 w-5 text-foreground" />
                    <span className="text-[10px] font-medium text-center leading-tight">{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Weekly Summary */}
        <WeeklySummary />

        {/* ABHA Banner */}
        <Link href="/abha">
          {selfMember?.abha_number ? (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">{t("home.abha_linked")}</p>
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
                <p className="text-sm font-bold text-green-800 dark:text-green-200">{t("home.link_abha")}</p>
                <p className="text-xs text-green-600 dark:text-green-400">{t("home.abha_desc")}</p>
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
                {t("home.upcoming_appointments")}
              </h2>
              <Link href="/appointments" className="text-xs text-primary font-medium">
                {t("home.view_all")}
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
                        {new Date(apt.date).toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })} · {apt.time}
                        {apt.purpose ? ` · ${apt.purpose}` : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Family Members */}
        {members.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">{t("home.family_members")}</h2>
              <Link href="/family" className="text-xs text-primary font-medium">
                {t("home.view_all")}
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
              {t("home.recent_records")}
            </h2>
            {records.length > 0 && (
              <Link href="/records" className="text-xs text-primary font-medium">
                {t("home.view_all")}
              </Link>
            )}
          </div>
          {recentRecords.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{t("home.no_records_title")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("home.no_records_desc")}
                </p>
                <div className="flex gap-2 justify-center mt-3">
                  <Link href="/scan">
                    <Button size="sm" variant="default">
                      <ScanLine className="h-4 w-4 mr-1" />
                      {t("nav.scan")}
                    </Button>
                  </Link>
                  <Link href="/records/add">
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      {t("common.add")}
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

      {/* === FEELING TODAY POPUP === */}
      {showFeeling && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={dismissFeeling} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{t("home.how_feeling")}</h3>
              <button onClick={dismissFeeling} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-between">
              {moodOptionDefs.map((mood) => {
                const Icon = mood.icon;
                return (
                  <button
                    key={mood.value}
                    onClick={() => handleFeelingSelect(mood.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl hover:${mood.bg} transition-all active:scale-95`}
                  >
                    <Icon className={`h-9 w-9 ${mood.color}`} />
                    <span className="text-[11px] font-medium">{t(mood.labelKey)}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={dismissFeeling}
              className="text-xs text-muted-foreground text-center w-full"
            >
              {t("home.skip_today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
