"use client";

import { useState } from "react";
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
import type { DayOfWeek } from "@/lib/db/schema";

const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const ALL_DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export default function RemindersPage() {
  const { reminders, todayReminders, isLoading, addReminder, toggleReminder, deleteReminder, logReminder } =
    useReminders();
  const { members } = useMembers();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [tab, setTab] = useState<"today" | "all">("today");

  // Add form state
  const [newMedicineName, setNewMedicineName] = useState("");
  const [newMemberId, setNewMemberId] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newDays, setNewDays] = useState<DayOfWeek[]>([...ALL_DAYS]);
  const [newDosage, setNewDosage] = useState("");
  const [newBeforeFood, setNewBeforeFood] = useState(false);

  const displayReminders = tab === "today" ? todayReminders : reminders;

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

  const handleAction = async (
    reminderId: string,
    action: "taken" | "skipped"
  ) => {
    try {
      await logReminder(reminderId, action);
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
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dosage</Label>
                    <Input
                      value={newDosage}
                      onChange={(e) => setNewDosage(e.target.value)}
                      placeholder="e.g. 500mg"
                    />
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
                          newDays.includes(day)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
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
                <Button className="w-full" onClick={handleAdd}>
                  Add Reminder
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            variant={tab === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("today")}
          >
            Today
          </Button>
          <Button
            variant={tab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("all")}
          >
            All ({reminders.length})
          </Button>
        </div>

        {/* Reminders List */}
        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : displayReminders.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={tab === "today" ? "No reminders for today" : "No reminders"}
            description="Add medicine reminders to never miss a dose. You can also scan a prescription to auto-create reminders."
            actionLabel="Add Reminder"
            onAction={() => setShowAddDialog(true)}
          />
        ) : (
          <div className="space-y-3">
            {[...displayReminders]
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((reminder) => (
                <Card key={reminder.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">
                            {reminder.medicine_name}
                          </h3>
                          {!reminder.is_active && (
                            <Badge variant="secondary" className="text-[10px]">
                              Paused
                            </Badge>
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
                          <span>
                            {reminder.before_food ? "Before food" : "After food"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {reminder.member_name}
                          </Badge>
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
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600"
                              onClick={() =>
                                handleAction(reminder.id, "taken")
                              }
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() =>
                                handleAction(reminder.id, "skipped")
                              }
                            >
                              <SkipForward className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleToggle(reminder.id)}
                        >
                          {reminder.is_active ? (
                            <ToggleRight className="h-4 w-4 text-primary" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleDelete(reminder.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
