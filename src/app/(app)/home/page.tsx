"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MemberSelector } from "@/components/family/member-selector";
import { RecordCard } from "@/components/records/record-card";
import { useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
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

const shortcutItems = [
  { href: "/scan", icon: ScanLine, label: "Scan Prescription" },
  { href: "/records/add", icon: Plus, label: "Add Record" },
  { href: "/symptom-tracker", icon: HeartPulse, label: "Feeling Today" },
  { href: "/doctor-report", icon: FileDown, label: "Doctor PDF" },
  { href: "/reminders", icon: Bell, label: "Reminders" },
  { href: "/family", icon: Users, label: "Family Members" },
  { href: "/more/shared-links", icon: Share2, label: "Shared Links" },
  { href: "/more/export", icon: Download, label: "Export Report" },
  { href: "/more/feedback", icon: MessageSquare, label: "Feedback" },
  { href: "/more/settings", icon: Settings, label: "Settings" },
];

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { members } = useMembers();
  const { selectedMemberId, setSelectedMember } = useFamilyStore();
  const { records } = useRecords(selectedMemberId || undefined);
  const [showMenu, setShowMenu] = useState(false);
  const [showFeeling, setShowFeeling] = useState(false);

  const selfMember = members.find((m) => m.relation === "self");
  const greeting = selfMember
    ? `Hi, ${selfMember.name.split(" ")[0]}`
    : "Welcome";
  const recentRecords = records.slice(0, 3);

  // Show "Feeling Today" popup once per day on first visit
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const lastShown = localStorage.getItem("medilog_feeling_shown");
    if (lastShown !== today) {
      // Delay popup by 1.5s so page loads first
      const timer = setTimeout(() => setShowFeeling(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleFeelingSelect = (mood: string) => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("medilog_feeling_shown", today);

    // Save quick mood to localStorage
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
    // If bad/terrible, go to symptom tracker for details
    if (mood === "bad" || mood === "terrible") {
      router.push("/symptom-tracker");
    }
  };

  const dismissFeeling = () => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("medilog_feeling_shown", today);
    setShowFeeling(false);
  };

  return (
    <div className="space-y-6">
      <PWAInstallBanner />

      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="MediLog"
              width={36}
              height={36}
              className="rounded-lg bg-white p-0.5"
            />
            <div>
              <h1 className="text-2xl font-bold">{greeting}</h1>
              <p className="text-primary-foreground/70 text-sm">{APP_NAME}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMenu(true)}
              className="h-10 w-10 rounded-full hover:bg-primary-foreground/10 flex items-center justify-center"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/reminders">
              <div className="h-10 w-10 rounded-full hover:bg-primary-foreground/10 flex items-center justify-center">
                <Bell className="h-5 w-5" />
              </div>
            </Link>
          </div>
        </div>

        {/* 3 Main Actions Only */}
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

      <div className="px-4 space-y-6">
        {/* Family Members */}
        {members.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Family Members</h2>
              <Link href="/family" className="text-sm text-primary font-medium">
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
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Recent Records
            </h2>
            {records.length > 0 && (
              <Link href="/records" className="text-sm text-primary font-medium">
                View All
              </Link>
            )}
          </div>
          {recentRecords.length === 0 ? (
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No records yet. Use the menu or scan button to get started.
                </p>
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

      {/* === SHORTCUTS MENU (full-screen slide-in) === */}
      {showMenu && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Menu Header */}
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
              {/* Emergency — highlighted */}
              {selfMember && (
                <Link
                  href={`/family/${selfMember.id}/emergency`}
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
                >
                  <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-red-700 dark:text-red-400">Emergency Card</span>
                    <p className="text-[10px] text-red-500">Blood group, allergies, contacts</p>
                  </div>
                </Link>
              )}

              {/* Feature Items */}
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

      {/* === FEELING TODAY POPUP (once per day) === */}
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
