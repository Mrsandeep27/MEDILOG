"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Pill,
  Calendar,
  Activity,
  Clock,
  User,
  Filter,
  Syringe,
  Receipt,
  ClipboardList,
  Smile,
  Meh,
  Frown,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { useRecords } from "@/hooks/use-records";
import { useMembers } from "@/hooks/use-members";
import { useReminders } from "@/hooks/use-reminders";
import { useAuthStore } from "@/stores/auth-store";
import { useFamilyStore } from "@/stores/family-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SymptomEntry {
  id: string;
  date: string;
  mood: "great" | "good" | "okay" | "bad" | "terrible";
  symptoms: string[];
  notes: string;
  timestamp: number;
}

type EventType = "record" | "symptom";

interface TimelineEvent {
  id: string;
  type: EventType;
  subType: string; // record type or "mood"
  title: string;
  description?: string;
  date: Date;
  memberId?: string;
  memberName?: string;
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} weeks ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)} months ago`;
  return `${Math.floor(diffDay / 365)}y ago`;
}

function getRecordIcon(subType: string) {
  switch (subType) {
    case "prescription":
      return Pill;
    case "lab_report":
      return ClipboardList;
    case "vaccination":
      return Syringe;
    case "bill":
      return Receipt;
    case "discharge_summary":
      return FileText;
    default:
      return FolderOpen;
  }
}

function getMoodIcon(mood: string) {
  switch (mood) {
    case "great":
    case "good":
      return Smile;
    case "okay":
      return Meh;
    case "bad":
      return Frown;
    case "terrible":
      return AlertCircle;
    default:
      return Meh;
  }
}

function getEventDotColor(type: EventType, subType: string): string {
  if (type === "symptom") {
    switch (subType) {
      case "great":
      case "good":
        return "bg-green-500";
      case "okay":
        return "bg-yellow-500";
      case "bad":
        return "bg-orange-500";
      case "terrible":
        return "bg-red-500";
      default:
        return "bg-purple-500";
    }
  }
  // record types
  switch (subType) {
    case "prescription":
      return "bg-blue-500";
    case "lab_report":
      return "bg-indigo-500";
    case "vaccination":
      return "bg-emerald-500";
    case "bill":
      return "bg-amber-500";
    case "discharge_summary":
      return "bg-rose-500";
    default:
      return "bg-slate-500";
  }
}

function getEventBgColor(): string {
  return "bg-muted/40";
}

function getTypeBadgeVariant(type: EventType): "default" | "secondary" | "outline" {
  return type === "record" ? "secondary" : "outline";
}

function formatSubType(subType: string): string {
  return subType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type TypeFilter = "all" | "records" | "symptoms";

const typeFilters: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "records", label: "Records" },
  { value: "symptoms", label: "Symptoms" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TimelinePage() {
  const user = useAuthStore((s) => s.user);
  const { members } = useMembers();
  const { records } = useRecords();
  const { selectedMemberId } = useFamilyStore();

  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [symptomEntries, setSymptomEntries] = useState<SymptomEntry[]>([]);

  // Load symptom entries from localStorage
  useEffect(() => {
    if (!user) return;
    try {
      const key = `medifamily_symptoms_${user.id}`;
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          setSymptomEntries(parsed);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [user]);

  // Build member lookup
  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.id, m.name);
    }
    return map;
  }, [members]);

  // Build unified timeline events
  const allEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    // Records
    for (const r of records) {
      events.push({
        id: r.id,
        type: "record",
        subType: r.type,
        title: r.title,
        description: [r.doctor_name && `Dr. ${r.doctor_name}`, r.diagnosis]
          .filter(Boolean)
          .join(" - ") || undefined,
        date: new Date(r.visit_date || r.created_at),
        memberId: r.member_id,
        memberName: memberMap.get(r.member_id),
        raw: r,
      });
    }

    // Symptoms
    for (const s of symptomEntries) {
      const symptomsText = s.symptoms.length > 0 ? s.symptoms.join(", ") : undefined;
      const desc = [symptomsText, s.notes].filter(Boolean).join(" - ") || undefined;
      events.push({
        id: `symptom-${s.id}`,
        type: "symptom",
        subType: s.mood,
        title: `Feeling ${s.mood}`,
        description: desc,
        date: new Date(s.date),
        memberId: undefined,
        memberName: members.find((m) => m.relation === "self")?.name || "You",
        raw: s,
      });
    }

    // Sort newest first
    events.sort((a, b) => b.date.getTime() - a.date.getTime());
    return events;
  }, [records, symptomEntries, memberMap, members]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => {
      // Member filter
      if (memberFilter && e.memberId && e.memberId !== memberFilter) return false;
      if (memberFilter && e.type === "symptom") {
        // Symptoms are always self - show only if "self" member is selected
        const selfMember = members.find((m) => m.relation === "self");
        if (selfMember && selfMember.id !== memberFilter) return false;
      }

      // Type filter
      if (typeFilter === "records" && e.type !== "record") return false;
      if (typeFilter === "symptoms" && e.type !== "symptom") return false;

      return true;
    });
  }, [allEvents, memberFilter, typeFilter, members]);

  // Group events by date label
  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: TimelineEvent[] }[] = [];
    let currentLabel = "";

    for (const event of filteredEvents) {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const eventDateStr = event.date.toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      let label: string;
      if (eventDateStr === todayStr) {
        label = "Today";
      } else if (eventDateStr === yesterdayStr) {
        label = "Yesterday";
      } else {
        label = event.date.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }

      if (label !== currentLabel) {
        groups.push({ label, events: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].events.push(event);
    }

    return groups;
  }, [filteredEvents]);

  return (
    <div>
      <AppHeader title="Health Timeline" showBack />

      <div className="p-4 space-y-4">
        {/* Member Filter */}
        {members.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setMemberFilter(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                memberFilter === null
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              All
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setMemberFilter(m.id === memberFilter ? null : m.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  memberFilter === m.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}

        {/* Type Filter */}
        <div className="flex gap-2">
          {typeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {filteredEvents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No health events yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add records or log symptoms to see your health timeline
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedEvents.map((group) => (
              <div key={group.label}>
                {/* Date Group Label */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Timeline Events */}
                <div className="relative pl-8">
                  {/* Vertical line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-px border-l-2 border-dotted border-muted-foreground/30" />

                  <div className="space-y-3">
                    {group.events.map((event) => {
                      const Icon =
                        event.type === "record"
                          ? getRecordIcon(event.subType)
                          : getMoodIcon(event.subType);
                      const dotColor = getEventDotColor(event.type, event.subType);
                      const bgColor = getEventBgColor();

                      return (
                        <div key={event.id} className="relative">
                          {/* Dot on the timeline */}
                          <div
                            className={`absolute -left-8 top-3 h-[22px] w-[22px] rounded-full ${dotColor} flex items-center justify-center ring-4 ring-background z-10`}
                          >
                            <Icon className="h-3 w-3 text-white" />
                          </div>

                          {/* Event Card */}
                          <Card className={`${bgColor} border-none shadow-sm`}>
                            <CardContent className="py-3 px-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate">
                                    {event.title}
                                  </p>
                                  {event.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                      {event.description}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1 shrink-0 pt-0.5">
                                  <Clock className="h-3 w-3" />
                                  {getRelativeTime(event.date)}
                                </span>
                              </div>

                              {/* Badges row */}
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {event.memberName && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 h-5 gap-1"
                                  >
                                    <User className="h-2.5 w-2.5" />
                                    {event.memberName}
                                  </Badge>
                                )}
                                <Badge
                                  variant={getTypeBadgeVariant(event.type)}
                                  className="text-[10px] px-1.5 py-0 h-5"
                                >
                                  {formatSubType(event.subType)}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
