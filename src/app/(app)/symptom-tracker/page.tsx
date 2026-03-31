"use client";

import { useState, useEffect } from "react";
import {
  Smile,
  Meh,
  Frown,
  AlertCircle,
  Plus,
  Calendar,
  TrendingUp,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/layout/app-header";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

interface SymptomEntry {
  id: string;
  date: string;
  mood: "great" | "good" | "okay" | "bad" | "terrible";
  symptoms: string[];
  painLevel: number;
  bodyAreas: string[];
  notes: string;
  timestamp: number;
}

const moodOptions = [
  { value: "great" as const, icon: Smile, label: "Great", color: "text-green-500", bg: "bg-green-100 dark:bg-green-900", score: 5 },
  { value: "good" as const, icon: Smile, label: "Good", color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900", score: 4 },
  { value: "okay" as const, icon: Meh, label: "Okay", color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900", score: 3 },
  { value: "bad" as const, icon: Frown, label: "Bad", color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900", score: 2 },
  { value: "terrible" as const, icon: AlertCircle, label: "Terrible", color: "text-red-500", bg: "bg-red-100 dark:bg-red-900", score: 1 },
];

const commonSymptoms = [
  "Headache", "Fever", "Cough", "Cold", "Body Pain",
  "Fatigue", "Nausea", "Stomach Pain", "Dizziness",
  "Back Pain", "Joint Pain", "Acidity", "Weakness",
  "Breathlessness", "Chest Pain", "Anxiety", "Insomnia",
  "Sore Throat", "Vomiting", "Diarrhea",
];

const bodyAreas = [
  "Head", "Eyes", "Ears", "Throat", "Chest",
  "Stomach", "Back", "Left Arm", "Right Arm",
  "Left Leg", "Right Leg", "Neck", "Shoulders",
];

function getStorageKey(userId: string) {
  return `medilog_symptoms_${userId}`;
}

function getEntries(userId: string): SymptomEntry[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(getStorageKey(userId));
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(userId: string, entries: SymptomEntry[]) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(entries));
}

function getMostCommonSymptom(entries: SymptomEntry[]): string | null {
  const counts = new Map<string, number>();
  entries.forEach((e) => e.symptoms.forEach((s) => counts.set(s, (counts.get(s) || 0) + 1)));
  let max = 0;
  let result: string | null = null;
  counts.forEach((count, symptom) => { if (count > max) { max = count; result = symptom; } });
  return result;
}

export default function SymptomTrackerPage() {
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<SymptomEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedMood, setSelectedMood] = useState<SymptomEntry["mood"] | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [painLevel, setPainLevel] = useState(0);
  const [selectedBodyAreas, setSelectedBodyAreas] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    if (user) setEntries(getEntries(user.id));
  }, [user]);

  const today = new Date().toISOString().split("T")[0];
  const todayEntry = entries.find((e) => e.date === today);

  const handleSave = () => {
    if (!selectedMood || !user) {
      toast.error("Please select how you're feeling");
      return;
    }

    const entry: SymptomEntry = {
      id: Date.now().toString(),
      date: today,
      mood: selectedMood,
      symptoms: selectedSymptoms,
      painLevel,
      bodyAreas: selectedBodyAreas,
      notes: notes.trim(),
      timestamp: Date.now(),
    };

    const updated = entries.filter((e) => e.date !== today);
    updated.unshift(entry);
    setEntries(updated);
    saveEntries(user.id, updated);

    setShowForm(false);
    setSelectedMood(null);
    setSelectedSymptoms([]);
    setPainLevel(0);
    setSelectedBodyAreas([]);
    setNotes("");
    toast.success("Today's health log saved!");
  };

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  const toggleBodyArea = (area: string) => {
    setSelectedBodyAreas((prev) =>
      prev.includes(area)
        ? prev.filter((a) => a !== area)
        : [...prev, area]
    );
  };

  const last7Days = entries.slice(0, 7);
  const last30Days = entries.slice(0, 30);
  const moodScore: Record<string, number> = { great: 5, good: 4, okay: 3, bad: 2, terrible: 1 };
  const avgMood = last7Days.length > 0
    ? (last7Days.reduce((acc, e) => acc + moodScore[e.mood], 0) / last7Days.length).toFixed(1)
    : null;
  const mostCommon = getMostCommonSymptom(last30Days);

  // Symptom frequency for trend
  const symptomFreq = new Map<string, number>();
  last30Days.forEach((e) => e.symptoms.forEach((s) => symptomFreq.set(s, (symptomFreq.get(s) || 0) + 1)));
  const topSymptoms = [...symptomFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const painColors = [
    "bg-green-400", "bg-green-400", "bg-lime-400", "bg-yellow-400",
    "bg-yellow-500", "bg-orange-400", "bg-orange-500", "bg-red-400",
    "bg-red-500", "bg-red-600", "bg-red-700",
  ];

  return (
    <div>
      <AppHeader title="Symptom Tracker" showBack />
      <div className="p-4 space-y-4">
        {/* Today's Check-in */}
        {!showForm && (
          <Card className={todayEntry ? "border-green-200 dark:border-green-800" : "border-primary"}>
            <CardContent className="py-4 text-center">
              {todayEntry ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    {(() => {
                      const m = moodOptions.find((o) => o.value === todayEntry.mood);
                      const Icon = m?.icon || Meh;
                      return <Icon className={`h-8 w-8 ${m?.color}`} />;
                    })()}
                  </div>
                  <p className="text-sm font-medium">
                    You&apos;re feeling <strong>{todayEntry.mood}</strong> today
                  </p>
                  {todayEntry.painLevel > 0 && (
                    <p className="text-xs text-muted-foreground">Pain level: {todayEntry.painLevel}/10</p>
                  )}
                  {todayEntry.symptoms.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1">
                      {todayEntry.symptoms.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}
                  {todayEntry.bodyAreas?.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1">
                      {todayEntry.bodyAreas.map((a) => (
                        <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
                    Update today&apos;s log
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">How are you feeling today?</h3>
                  <p className="text-sm text-muted-foreground">
                    Daily tracking helps spot patterns with your health
                  </p>
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Log Today
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Log Form */}
        {showForm && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How are you feeling?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mood Selection */}
              <div className="flex justify-between">
                {moodOptions.map((mood) => {
                  const Icon = mood.icon;
                  const isSelected = selectedMood === mood.value;
                  return (
                    <button
                      key={mood.value}
                      onClick={() => setSelectedMood(mood.value)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                        isSelected ? `${mood.bg} ring-2 ring-primary scale-110` : "hover:bg-muted"
                      }`}
                    >
                      <Icon className={`h-8 w-8 ${mood.color}`} />
                      <span className="text-[10px] font-medium">{mood.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Pain Level Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Pain Level</p>
                  <span className={`text-sm font-bold ${painLevel === 0 ? "text-green-500" : painLevel <= 3 ? "text-yellow-500" : painLevel <= 6 ? "text-orange-500" : "text-red-500"}`}>
                    {painLevel}/10
                  </span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPainLevel(i)}
                      className={`flex-1 h-8 rounded-md text-[10px] font-medium transition-all ${
                        painLevel === i
                          ? `${painColors[i]} text-white scale-110 ring-2 ring-offset-1 ring-current`
                          : i <= painLevel
                          ? `${painColors[i]} opacity-60`
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body Areas */}
              <div>
                <p className="text-sm font-medium mb-2">Where does it hurt?</p>
                <div className="flex flex-wrap gap-1.5">
                  {bodyAreas.map((area) => (
                    <button
                      key={area}
                      onClick={() => toggleBodyArea(area)}
                      className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                        selectedBodyAreas.includes(area)
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              {/* Symptoms */}
              <div>
                <p className="text-sm font-medium mb-2">Any symptoms?</p>
                <div className="flex flex-wrap gap-1.5">
                  {commonSymptoms.map((symptom) => (
                    <button
                      key={symptom}
                      onClick={() => toggleSymptom(symptom)}
                      className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                        selectedSymptoms.includes(symptom)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                    >
                      {symptom}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-sm font-medium mb-1">Notes (optional)</p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any other details..."
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1" disabled={!selectedMood}>
                  Save
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Summary */}
        {last7Days.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-lg font-bold text-primary">{avgMood}</div>
                <p className="text-[10px] text-muted-foreground">Avg Mood (7d)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-lg font-bold text-orange-500">{last30Days.filter((e) => e.painLevel > 5).length}</div>
                <p className="text-[10px] text-muted-foreground">High Pain Days</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-xs font-bold text-muted-foreground truncate px-1">{mostCommon || "—"}</div>
                <p className="text-[10px] text-muted-foreground">Most Common</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Weekly Trend */}
        {last7Days.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Weekly Mood Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between h-20 gap-1">
                {Array.from({ length: 7 }).map((_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() - (6 - i));
                  const dateStr = date.toISOString().split("T")[0];
                  const entry = entries.find((e) => e.date === dateStr);
                  const score = entry ? moodScore[entry.mood] : 0;
                  const height = score ? `${(score / 5) * 100}%` : "8%";
                  const mood = entry ? moodOptions.find((m) => m.value === entry.mood) : null;
                  const dayLabel = date.toLocaleDateString("en", { weekday: "short" }).slice(0, 2);

                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full flex items-end justify-center" style={{ height: "60px" }}>
                        <div
                          className={`w-6 rounded-t transition-all ${
                            mood ? mood.bg : "bg-muted"
                          }`}
                          style={{ height }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{dayLabel}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Symptoms (30 days) */}
        {topSymptoms.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Top Symptoms (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topSymptoms.map(([symptom, count]) => {
                const maxCount = topSymptoms[0][1];
                const width = `${(count / maxCount) * 100}%`;
                return (
                  <div key={symptom} className="flex items-center gap-2">
                    <span className="text-xs w-24 truncate text-muted-foreground">{symptom}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full flex items-center justify-end pr-2"
                        style={{ width }}
                      >
                        <span className="text-[9px] font-medium text-primary-foreground">{count}x</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* History */}
        {entries.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                History
              </h3>
              {entries.length > 7 && (
                <button
                  onClick={() => setShowAllHistory(!showAllHistory)}
                  className="text-xs text-primary font-medium flex items-center gap-1"
                >
                  {showAllHistory ? "Show Less" : "Show All"}
                  {showAllHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {entries.slice(0, showAllHistory ? entries.length : 7).map((entry) => {
                const mood = moodOptions.find((m) => m.value === entry.mood);
                const Icon = mood?.icon || Meh;
                return (
                  <Card key={entry.id}>
                    <CardContent className="py-2.5 flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${mood?.bg}`}>
                        <Icon className={`h-4 w-4 ${mood?.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium capitalize">{entry.mood}</span>
                          {entry.painLevel > 0 && (
                            <Badge variant={entry.painLevel > 5 ? "destructive" : "secondary"} className="text-[9px]">
                              Pain {entry.painLevel}/10
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                        {entry.symptoms.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.symptoms.join(", ")}
                          </p>
                        )}
                        {entry.bodyAreas?.length > 0 && (
                          <p className="text-[10px] text-red-500 truncate">
                            Pain areas: {entry.bodyAreas.join(", ")}
                          </p>
                        )}
                      </div>
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
