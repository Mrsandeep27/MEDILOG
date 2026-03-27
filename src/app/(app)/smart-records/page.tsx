"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  Droplets,
  Brain,
  Bone,
  Eye,
  Stethoscope,
  Pill,
  Baby,
  ShieldCheck,
  FileText,
  Activity,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRecords } from "@/hooks/use-records";
import { useMembers } from "@/hooks/use-members";
import { useFamilyStore } from "@/stores/family-store";
import { EmptyState } from "@/components/common/empty-state";

// ─── Organ/System categories with keyword matching ───────────────────────────
const ORGAN_CATEGORIES = [
  {
    id: "blood",
    label: "Blood",
    icon: Droplets,
    color: "#ef4444",
    bg: "bg-red-50",
    border: "border-red-200",
    keywords: ["blood", "hemoglobin", "hb", "cbc", "rbc", "wbc", "platelet", "hematocrit", "esr", "iron", "ferritin", "anemia", "hemoglobin"],
  },
  {
    id: "heart",
    label: "Heart",
    icon: Heart,
    color: "#ec4899",
    bg: "bg-pink-50",
    border: "border-pink-200",
    keywords: ["heart", "cardiac", "ecg", "echo", "bp", "blood pressure", "cholesterol", "lipid", "triglyceride", "hdl", "ldl", "cardiovascular"],
  },
  {
    id: "sugar",
    label: "Sugar",
    icon: Activity,
    color: "#f59e0b",
    bg: "bg-amber-50",
    border: "border-amber-200",
    keywords: ["sugar", "glucose", "diabetes", "hba1c", "fasting", "insulin", "glycated", "diabetic", "gtol"],
  },
  {
    id: "thyroid",
    label: "Thyroid",
    icon: Zap,
    color: "#8b5cf6",
    bg: "bg-violet-50",
    border: "border-violet-200",
    keywords: ["thyroid", "tsh", "t3", "t4", "thyroxine"],
  },
  {
    id: "kidney",
    label: "Kidney",
    icon: ShieldCheck,
    color: "#06b6d4",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    keywords: ["kidney", "renal", "creatinine", "urea", "bun", "gfr", "urine", "uric acid", "dialysis"],
  },
  {
    id: "liver",
    label: "Liver",
    icon: Stethoscope,
    color: "#22c55e",
    bg: "bg-green-50",
    border: "border-green-200",
    keywords: ["liver", "hepatic", "sgpt", "sgot", "alt", "ast", "bilirubin", "albumin", "hepatitis", "jaundice"],
  },
  {
    id: "bone",
    label: "Bone & Joint",
    icon: Bone,
    color: "#64748b",
    bg: "bg-slate-50",
    border: "border-slate-200",
    keywords: ["bone", "joint", "calcium", "vitamin d", "arthritis", "xray", "x-ray", "fracture", "osteo", "spine", "orthopedic"],
  },
  {
    id: "brain",
    label: "Brain & Neuro",
    icon: Brain,
    color: "#a855f7",
    bg: "bg-purple-50",
    border: "border-purple-200",
    keywords: ["brain", "neuro", "mri", "ct scan", "headache", "migraine", "seizure", "epilepsy", "stroke"],
  },
  {
    id: "eye",
    label: "Eye",
    icon: Eye,
    color: "#3b82f6",
    bg: "bg-blue-50",
    border: "border-blue-200",
    keywords: ["eye", "vision", "ophthal", "retina", "cataract", "glaucoma", "spectacle"],
  },
  {
    id: "infection",
    label: "Infection",
    icon: ShieldCheck,
    color: "#f97316",
    bg: "bg-orange-50",
    border: "border-orange-200",
    keywords: ["infection", "fever", "typhoid", "malaria", "dengue", "covid", "tuberculosis", "tb", "antibiotic", "viral", "bacterial"],
  },
  {
    id: "vaccination",
    label: "Vaccination",
    icon: Baby,
    color: "#14b8a6",
    bg: "bg-teal-50",
    border: "border-teal-200",
    keywords: ["vaccine", "vaccination", "immunization", "booster", "dose"],
  },
  {
    id: "general",
    label: "General",
    icon: Pill,
    color: "#6b7280",
    bg: "bg-gray-50",
    border: "border-gray-200",
    keywords: [],
  },
];

function categorizeRecord(record: { title?: string; diagnosis?: string; notes?: string; raw_ocr_text?: string; tags?: string[]; type?: string }): string {
  const text = [
    record.title || "",
    record.diagnosis || "",
    record.notes || "",
    record.raw_ocr_text || "",
    ...(record.tags || []),
  ].join(" ").toLowerCase();

  // Vaccination type
  if (record.type === "vaccination") return "vaccination";

  for (const cat of ORGAN_CATEGORIES) {
    if (cat.id === "general") continue;
    if (cat.keywords.some((kw) => text.includes(kw))) return cat.id;
  }

  return "general";
}

export default function SmartRecordsPage() {
  const { members } = useMembers();
  const { selectedMemberId } = useFamilyStore();
  const { records } = useRecords(selectedMemberId || undefined);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const selfMember = members.find((m) => m.relation === "self");
  const activeMember = selectedMemberId
    ? members.find((m) => m.id === selectedMemberId)
    : selfMember;

  // Categorize all records
  const categorized = new Map<string, typeof records>();
  for (const record of records) {
    const cat = categorizeRecord(record);
    if (!categorized.has(cat)) categorized.set(cat, []);
    categorized.get(cat)!.push(record);
  }

  const selectedRecords = selectedCat ? categorized.get(selectedCat) || [] : [];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Link href="/home"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold">My Health</h1>
        {activeMember && (
          <span className="text-xs text-muted-foreground ml-auto">{activeMember.name}</span>
        )}
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Category Grid */}
        <div className="grid grid-cols-2 gap-3">
          {ORGAN_CATEGORIES.map((cat) => {
            const count = categorized.get(cat.id)?.length || 0;
            if (count === 0 && cat.id !== "general") return null;
            const CatIcon = cat.icon;
            const latest = categorized.get(cat.id)?.[0];
            const timeAgo = latest
              ? getTimeAgo(new Date(latest.visit_date || latest.created_at))
              : null;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                className={`${cat.bg} ${cat.border} border rounded-2xl p-4 text-left transition-all ${
                  selectedCat === cat.id ? "ring-2 ring-offset-1" : ""
                }`}
                style={selectedCat === cat.id ? { outlineColor: cat.color, outlineWidth: 2, outlineStyle: "solid" as const, outlineOffset: 2 } : undefined}
              >
                <CatIcon className="h-7 w-7 mb-2" style={{ color: cat.color }} />
                <p className="font-bold text-sm">{cat.label}</p>
                {count > 0 && (
                  <>
                    <Badge variant="secondary" className="text-[10px] mt-1.5 px-1.5 py-0">
                      {count} record{count > 1 ? "s" : ""}
                    </Badge>
                    {timeAgo && (
                      <p className="text-[10px] text-muted-foreground mt-1">{timeAgo}</p>
                    )}
                  </>
                )}
              </button>
            );
          }).filter(Boolean)}
        </div>

        {/* Selected Category Records */}
        {selectedCat && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm px-1">
              {ORGAN_CATEGORIES.find((c) => c.id === selectedCat)?.label} Records
            </h3>
            {selectedRecords.length === 0 ? (
              <EmptyState icon={FileText} title="No records in this category" description="Records will appear here as you add them" className="py-6" />
            ) : (
              selectedRecords.map((record) => (
                <Link key={record.id} href={`/records/${record.id}`}>
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{record.title || "Untitled Record"}</p>
                          <p className="text-xs text-muted-foreground">
                            {record.doctor_name && `Dr. ${record.doctor_name} · `}
                            {new Date(record.visit_date || record.created_at).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </p>
                          {record.diagnosis && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{record.diagnosis}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{record.type}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Empty */}
        {records.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No health records yet"
            description="Add records or scan prescriptions to see them categorized by organ system"
            className="py-12"
          />
        )}
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  const years = Math.round(months / 12 * 10) / 10;
  return `${years} year${years > 1 ? "s" : ""} ago`;
}
