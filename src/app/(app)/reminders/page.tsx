"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Bell,
  Plus,
  Check,
  X,
  Clock,
  SkipForward,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Award,
  TrendingUp,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useReminders } from "@/hooks/use-reminders";
import { useMembers } from "@/hooks/use-members";
import type { DayOfWeek, ReminderLog } from "@/lib/db/schema";

const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

const ALL_DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function getAdherenceForDay(logs: ReminderLog[], dateStr: string): "full" | "partial" | "missed" | "none" {
  const dayLogs = logs.filter((l) => l.scheduled_at.startsWith(dateStr));
  if (dayLogs.length === 0) return "none";
  const taken = dayLogs.filter((l) => l.status === "taken").length;
  if (taken === dayLogs.length) return "full";
  if (taken > 0) return "partial";
  return "missed";
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

export default function RemindersPage() {
  const { reminders, todayReminders, isLoading, addReminder, toggleReminder, deleteReminder, logReminder } =
    useReminders();
  const { members } = useMembers();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [tab, setTab] = useState<"today" | "all" | "stats">("today");
  const [allLogs, setAllLogs] = useState<ReminderLog[]>([]);

  // Load all reminder logs for adherence
  useEffect(() => {
    import("@/lib/db/dexie").then(({ db }) => {
      db.reminderLogs.toArray().then(setAllLogs);
    });
  }, []);

  // Add form state
  const [newMedicineName, setNewMedicineName] = useState("");
  const [newMemberId, setNewMemberId] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newDays, setNewDays] = useState<DayOfWeek[]>([...ALL_DAYS]);
  const [newDosage, setNewDosage] = useState("");
  const [newBeforeFood, setNewBeforeFood] = useState(false);

  const displayReminders = tab === "today" ? todayReminders : reminders;

  // Adherence stats
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekLogs = allLogs.filter((l) => new Date(l.scheduled_at) >= weekAgo);
  const takenCount = weekLogs.filter((l) => l.status === "taken").length;
  const totalCount = weekLogs.length;
  const adherencePercent = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;
  const streak = getStreak(allLogs);

  // Calendar data (last 28 days)
  const calendarDays = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    return d.toISOString().split("T")[0];
  });

  const handleAdd = async () => {
    const member = members.find((m) => m.id === newMemberId);
    if (!newMedicineName || !member) {
      toast.error("Please fill in medicine name and select a member");
      return;
    }
    try {
      await addReminder({
        medicine_id: "",
        member_id: member.id,
        medicine_name: newMedicineName,
        member_name: member.name,
        dosage: newDosage || undefined,
        before_food: newBeforeFood,
        time: newTime,
        days: newDays,
        is_active: true,
      });
      toast.success("Reminder added");
      setShowAddDialog(false);
      resetForm();
    } catch {
      toast.error("Failed to add reminder");
    }
  };

  const resetForm = () => {
    setNewMedicineName("");
    setNewMemberId("");
    setNewTime("09:00");
    setNewDays([...ALL_DAYS]);
    setNewDosage("");
    setNewBeforeFood(false);
  };

  const toggleDay = (day: DayOfWeek) => {
    setNewDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleAction = async (reminderId: string, action: "taken" | "skipped") => {
    try {
      await logReminder(reminderId, action);
      // Reload logs
      const { db } = await import("@/lib/db/dexie");
      const logs = await db.reminderLogs.toArray();
      setAllLogs(logs);
      toast.success(action === "taken" ? "Marked as taken" : "Skipped");
    } catch {
      toast.error("Failed to log action");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReminder(id);
      toast.success("Reminder deleted");
    } catch {
      toast.error("Failed to delete reminder");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleReminder(id);
    } catch {
      toast.error("Failed to toggle reminder");
    }
  };

  const adherenceColor = (status: string) => {
    switch (status) {
      case "full": return "bg-green-500";
      case "partial": return "bg-yellow-500";
      case "missed": return "bg-red-500";
      default: return "bg-muted";
    }
  };

  return (
    <div>
      <AppHeader
        title="Reminders"
        rightAction={
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger
              render={<Button size="sm" />}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Reminder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Medicine Name *</Label>
                  <Input
                    value={newMedicineName}
                    onChange={(e) => setNewMedicineName(e.target.value)}
                    placeholder="e.g. Paracetamol"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Family Member *</Label>
                  <Select value={newMemberId} onValueChange={(v) => setNewMemberId(v || "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dosage</Label>
                    <Input value={newDosage} onChange={(e) => setNewDosage(e.target.value)} placeholder="e.g. 500mg" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Days</Label>
                  <div className="flex gap-1">
                    {ALL_DAYS.map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${
                          newDays.includes(day) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {DAY_LABELS[day][0]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={newBeforeFood ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setNewBeforeFood(!newBeforeFood)}
                  >
                    {newBeforeFood ? "Before food" : "After food"}
                  </Badge>
                </div>
                <Button className="w-full" onClick={handleAdd}>Add Reminder</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <Button variant={tab === "today" ? "default" : "outline"} size="sm" onClick={() => setTab("today")}>
            Today
          </Button>
          <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => setTab("all")}>
            All ({reminders.length})
          </Button>
          <Button variant={tab === "stats" ? "default" : "outline"} size="sm" onClick={() => setTab("stats")}>
            <TrendingUp className="h-3.5 w-3.5 mr-1" />
            Stats
          </Button>
        </div>

        {/* Stats Tab */}
        {tab === "stats" && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardContent className="py-3 text-center">
                  <div className="text-2xl font-bold text-primary">{adherencePercent}%</div>
                  <p className="text-[10px] text-muted-foreground">Weekly Adherence</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 text-center">
                  <div className="text-2xl font-bold text-amber-500 flex items-center justify-center gap-1">
                    {streak}<Flame className="h-5 w-5" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Day Streak</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 text-center">
                  <div className="text-2xl font-bold text-green-500">{takenCount}</div>
                  <p className="text-[10px] text-muted-foreground">Taken (7d)</p>
                </CardContent>
              </Card>
            </div>

            {/* Adherence Calendar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Adherence Calendar (28 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1.5">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <div key={i} className="text-[9px] text-muted-foreground text-center font-medium">{d}</div>
                  ))}
                  {calendarDays.map((dateStr) => {
                    const status = getAdherenceForDay(allLogs, dateStr);
                    const isToday = dateStr === new Date().toISOString().split("T")[0];
                    return (
                      <div
                        key={dateStr}
                        className={`aspect-square rounded-md flex items-center justify-center text-[9px] font-medium ${adherenceColor(status)} ${
                          status !== "none" ? "text-white" : "text-muted-foreground"
                        } ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}`}
                        title={`${dateStr}: ${status}`}
                      >
                        {new Date(dateStr + "T12:00:00").getDate()}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mt-3 justify-center">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-green-500" />
                    <span className="text-[9px] text-muted-foreground">All taken</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-yellow-500" />
                    <span className="text-[9px] text-muted-foreground">Partial</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-red-500" />
                    <span className="text-[9px] text-muted-foreground">Missed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-muted" />
                    <span className="text-[9px] text-muted-foreground">No data</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Streak Motivation */}
            {streak > 0 && (
              <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                    <Award className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      {streak} day streak!
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {streak >= 7
                        ? "Incredible! Keep going!"
                        : streak >= 3
                        ? "Great consistency! Don't break it!"
                        : "Good start! Build the habit!"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Reminders List (today / all) */}
        {tab !== "stats" && (
          <>
            {isLoading ? (
              <LoadingSpinner className="py-12" />
            ) : (displayReminders?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Bell}
                title={tab === "today" ? "No reminders for today" : "No reminders"}
                description="Add medicine reminders to never miss a dose. You can also scan a prescription to auto-create reminders."
                actionLabel="Add Reminder"
                onAction={() => setShowAddDialog(true)}
              />
            ) : (
              <div className="space-y-3">
                {[...(displayReminders || [])]
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((reminder) => (
                    <Card key={reminder.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{reminder.medicine_name}</h3>
                              {!reminder.is_active && (
                                <Badge variant="secondary" className="text-[10px]">Paused</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{reminder.time}</span>
                              {reminder.dosage && (
                                <>
                                  <span>·</span>
                                  <span>{reminder.dosage}</span>
                                </>
                              )}
                              <span>·</span>
                              <span>{reminder.before_food ? "Before food" : "After food"}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1.5">
                              <Badge variant="outline" className="text-[10px]">{reminder.member_name}</Badge>
                              <div className="flex gap-0.5 ml-1">
                                {reminder.days.map((day) => (
                                  <span
                                    key={day}
                                    className="text-[9px] w-4 h-4 rounded-full bg-muted flex items-center justify-center font-medium"
                                  >
                                    {DAY_LABELS[day][0]}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {tab === "today" && reminder.is_active && (
                              <>
                                <Button
                                  size="icon" variant="ghost" className="h-8 w-8 text-green-600"
                                  onClick={() => handleAction(reminder.id, "taken")}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon" variant="ghost" className="h-8 w-8"
                                  onClick={() => handleAction(reminder.id, "skipped")}
                                >
                                  <SkipForward className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleToggle(reminder.id)}>
                              {reminder.is_active ? (
                                <ToggleRight className="h-4 w-4 text-primary" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(reminder.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
