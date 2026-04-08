"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Calendar,
  Plus,
  Clock,
  MapPin,
  User,
  Trash2,
  Bell,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/common/empty-state";
import { useMembers } from "@/hooks/use-members";
import { useAuthStore } from "@/stores/auth-store";

interface Appointment {
  id: string;
  member_id: string;
  member_name: string;
  doctor_name: string;
  hospital: string;
  date: string;
  time: string;
  purpose: string;
  notes: string;
  reminder: boolean;
  created_at: number;
}

function getStorageKey(userId: string) {
  return `medifamily_appointments_${userId}`;
}

function loadAppointments(userId: string): Appointment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAppointments(userId: string, appointments: Appointment[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getStorageKey(userId), JSON.stringify(appointments));
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

function isWithin24Hours(dateStr: string, timeStr: string): boolean {
  const appointmentDate = new Date(`${dateStr}T${timeStr}`);
  const now = new Date();
  const diff = appointmentDate.getTime() - now.getTime();
  return diff > 0 && diff <= 24 * 60 * 60 * 1000;
}

function isFutureAppointment(dateStr: string, timeStr: string): boolean {
  const appointmentDate = new Date(`${dateStr}T${timeStr}`);
  return appointmentDate.getTime() > Date.now();
}

export default function AppointmentsPage() {
  const user = useAuthStore((s) => s.user);
  const { members } = useMembers();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  // Form state
  const [doctorName, setDoctorName] = useState("");
  const [hospital, setHospital] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [memberId, setMemberId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(() => {
    if (user?.id) {
      setAppointments(loadAppointments(user.id));
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const upcoming = appointments
    .filter((a) => isFutureAppointment(a.date, a.time))
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const past = appointments
    .filter((a) => !isFutureAppointment(a.date, a.time))
    .sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

  const displayAppointments = tab === "upcoming" ? upcoming : past;

  const resetForm = () => {
    setDoctorName("");
    setHospital("");
    setDate("");
    setTime("");
    setMemberId("");
    setPurpose("");
    setNotes("");
  };

  const handleAdd = () => {
    if (!user?.id) return;

    if (!doctorName.trim() || !date || !time || !memberId) {
      toast.error("Please fill in all required fields");
      return;
    }

    const member = members.find((m) => m.id === memberId);
    if (!member) {
      toast.error("Please select a family member");
      return;
    }

    const newAppointment: Appointment = {
      id: crypto.randomUUID(),
      member_id: memberId,
      member_name: member.name,
      doctor_name: doctorName.trim(),
      hospital: hospital.trim(),
      date,
      time,
      purpose: purpose.trim(),
      notes: notes.trim(),
      reminder: true,
      created_at: Date.now(),
    };

    const updated = [...appointments, newAppointment];
    setAppointments(updated);
    saveAppointments(user.id, updated);
    toast.success("Appointment added");
    setShowAddDialog(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!user?.id) return;
    const updated = appointments.filter((a) => a.id !== id);
    setAppointments(updated);
    saveAppointments(user.id, updated);
    toast.success("Appointment deleted");
  };

  return (
    <div>
      <AppHeader
        title="Appointments"
        showBack
        rightAction={
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            // Reset on both open AND close to guarantee no stale state
            resetForm();
          }}>
            <DialogTrigger
              render={<Button size="sm" />}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Appointment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Doctor Name *</Label>
                  <Input
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="e.g. Dr. Sharma"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hospital</Label>
                  <Input
                    value={hospital}
                    onChange={(e) => setHospital(e.target.value)}
                    placeholder="e.g. Apollo Hospital"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time *</Label>
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Family Member *</Label>
                  <Select value={memberId} onValueChange={(v) => setMemberId(v || "")}>
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
                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Input
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Follow-up, Consultation"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={3}
                  />
                </div>
                <Button className="w-full" onClick={handleAdd}>
                  Add Appointment
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
            variant={tab === "upcoming" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("upcoming")}
          >
            Upcoming ({upcoming.length})
          </Button>
          <Button
            variant={tab === "past" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("past")}
          >
            Past ({past.length})
          </Button>
        </div>

        {/* Appointments List */}
        {displayAppointments.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={tab === "upcoming" ? "No upcoming appointments" : "No past appointments"}
            description={
              tab === "upcoming"
                ? "Schedule your doctor visits and never miss an appointment."
                : "Your past appointments will appear here."
            }
            actionLabel={tab === "upcoming" ? "Add Appointment" : undefined}
            onAction={tab === "upcoming" ? () => setShowAddDialog(true) : undefined}
          />
        ) : (
          <div className="space-y-3">
            {displayAppointments.map((appointment) => {
              const soon = tab === "upcoming" && isWithin24Hours(appointment.date, appointment.time);
              return (
                <Card
                  key={appointment.id}
                  className={soon ? "border-orange-300 border-2" : ""}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">
                            {appointment.doctor_name}
                          </h3>
                          {soon && (
                            <Badge variant="secondary" className="text-[10px] shrink-0 bg-orange-100 text-orange-700">
                              <Bell className="h-2.5 w-2.5 mr-0.5" />
                              Soon
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>{formatDate(appointment.date)}</span>
                          <span>·</span>
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{formatTime(appointment.time)}</span>
                        </div>

                        {appointment.hospital && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{appointment.hospital}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            <User className="h-2.5 w-2.5 mr-0.5" />
                            {appointment.member_name}
                          </Badge>
                          {appointment.purpose && (
                            <Badge variant="secondary" className="text-[10px]">
                              {appointment.purpose}
                            </Badge>
                          )}
                        </div>

                        {appointment.notes && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {appointment.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {tab === "past" && (
                          <Link href="/records/add">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-primary"
                            >
                              Add Record
                              <ChevronRight className="h-3 w-3 ml-0.5" />
                            </Button>
                          </Link>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleDelete(appointment.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
