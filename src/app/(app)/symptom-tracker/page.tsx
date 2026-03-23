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
  notes: string;
  timestamp: number;
}

const moodOptions = [
  { value: "great" as const, icon: Smile, label: "Great", color: "text-green-500", bg: "bg-green-100 dark:bg-green-900" },
  { value: "good" as const, icon: Smile, label: "Good", color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900" },
  { value: "okay" as const, icon: Meh, label: "Okay", color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900" },
  { value: "bad" as const, icon: Frown, label: "Bad", color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900" },
  { value: "terrible" as const, icon: AlertCircle, label: "Terrible", color: "text-red-500", bg: "bg-red-100 dark:bg-red-900" },
];

const commonSymptoms = [
  "Headache", "Fever", "Cough", "Cold", "Body Pain",
  "Fatigue", "Nausea", "Stomach Pain", "Dizziness",
  "Back Pain", "Joint Pain", "Acidity", "Weakness",
  "Breathlessness", "Chest Pain", "Anxiety", "Insomnia",
];

function getStorageKey(userId: string) {
  return `medilog_symptoms_${userId}`;
}

function getEntries(userId: string): SymptomEntry[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(getStorageKey(userId));
  return data ? JSON.parse(data) : [];
}

function saveEntries(userId: string, entries: SymptomEntry[]) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(entries));
}

export default function SymptomTrackerPage() {
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<SymptomEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedMood, setSelectedMood] = useState<SymptomEntry["mood"] | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

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
      notes: notes.trim(),
      timestamp: Date.now(),
    };

    // Replace today's entry or add new
    const updated = entries.filter((e) => e.date !== today);
    updated.unshift(entry);
    setEntries(updated);
    saveEntries(user.id, updated);

    setShowForm(false);
    setSelectedMood(null);
    setSelectedSymptoms([]);
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

  const last7Days = entries.slice(0, 7);
  const moodScore = { great: 5, good: 4, okay: 3, bad: 2, terrible: 1 };

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
                  {todayEntry.symptoms.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1">
                      {todayEntry.symptoms.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
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
                    Daily tracking helps spot patterns with your medicines
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

        {/* Weekly Trend */}
        {last7Days.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Last 7 Days
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

        {/* History */}
        {entries.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              History
            </h3>
            <div className="space-y-2">
              {entries.slice(0, 14).map((entry) => {
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
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                        {entry.symptoms.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.symptoms.join(", ")}
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
