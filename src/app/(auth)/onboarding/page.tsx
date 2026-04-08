"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
import { useReminders } from "@/hooks/use-reminders";
import { MemberForm } from "@/components/family/member-form";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import type { MemberFormData } from "@/lib/utils/validators";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { syncAll } from "@/lib/db/sync";
import {
  Shield,
  Users,
  ScanLine,
  Bell,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Camera,
  Upload,
  Pill,
  Clock,
  Loader2,
  Award,
  Sparkles,
  X,
} from "lucide-react";
import type { DayOfWeek } from "@/lib/db/schema";

const ALL_DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// ---------------------------------------------------------------------------
// Progress bar (4 steps)
// ---------------------------------------------------------------------------
function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <div
          key={s}
          className={`h-2 rounded-full transition-all duration-300 ${
            s === current
              ? "w-8 bg-primary"
              : s < current
                ? "w-8 bg-primary/40"
                : "w-8 bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge unlocked animation
// ---------------------------------------------------------------------------
function BadgeUnlocked({ name, onDone }: { name: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200">
      <div className="bg-background rounded-2xl p-6 shadow-2xl text-center space-y-3 animate-in zoom-in-95 duration-300 max-w-[280px]">
        <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mx-auto">
          <Award className="h-8 w-8 text-amber-500" />
        </div>
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Badge Unlocked!</p>
        <p className="text-lg font-bold">{name}</p>
        <Sparkles className="h-5 w-5 text-amber-400 mx-auto" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Health Profile (MANDATORY)
// ---------------------------------------------------------------------------
function StepProfile({
  onSubmit,
}: {
  onSubmit: (data: MemberFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wider">Step 1 of 4</p>
        <h1 className="text-xl font-bold tracking-tight">
          Set up your health profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Takes 30 seconds. Makes your Emergency Card work instantly.
        </p>
      </div>

      <MemberForm
        onSubmit={onSubmit}
        submitLabel="Continue"
        defaultRelation="self"
        hideRelation
      />

      <StepProgress current={1} total={4} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Add Family Member (skippable)
// ---------------------------------------------------------------------------
function StepFamily({
  onSubmit,
  onSkip,
  loading,
}: {
  onSubmit: (data: MemberFormData) => void;
  onSkip: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mx-auto mb-2">
          <Users className="h-6 w-6 text-purple-600" />
        </div>
        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Step 2 of 4</p>
        <h1 className="text-xl font-bold tracking-tight">
          Add your first family member
        </h1>
        <p className="text-sm text-muted-foreground">
          Track health records for your whole family.
        </p>
      </div>

      <MemberForm
        onSubmit={onSubmit}
        loading={loading}
        submitLabel="Add & Continue"
        defaultRelation="spouse"
      />

      <button
        type="button"
        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        onClick={onSkip}
      >
        Skip for now &rarr;
      </button>

      <StepProgress current={2} total={4} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Scan Prescription (skippable)
// ---------------------------------------------------------------------------
interface ExtractedMed {
  name: string;
  dosage?: string;
  frequency?: string;
  before_food: boolean;
}

function StepScan({
  selfMemberId,
  onComplete,
  onSkip,
}: {
  selfMemberId: string;
  onComplete: (medicines: ExtractedMed[]) => void;
  onSkip: () => void;
}) {
  const { addRecord } = useRecords();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"upload" | "processing" | "review">("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [extractedMeds, setExtractedMeds] = useState<ExtractedMed[]>([]);
  const [extractedInfo, setExtractedInfo] = useState<{ doctor?: string; diagnosis?: string }>({});
  const [saving, setSaving] = useState(false);

  const handleFile = async (file: File) => {
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setImageFile(file);
    setPhase("processing");

    try {
      // OCR + AI extraction
      let ocrText = "";
      try {
        const { extractText } = await import("@/lib/ocr/tesseract");
        const result = await extractText(file);
        ocrText = result.text;
      } catch {
        ocrText = "(OCR failed — using AI vision)";
      }

      const { extractPrescription } = await import("@/lib/ai/extract-prescription");
      const result = await extractPrescription(ocrText, file);

      if (result.error) {
        toast.error("Could not extract prescription. Try a clearer photo.");
        setPhase("upload");
        return;
      }

      setExtractedMeds(result.medicines.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        before_food: m.before_food,
      })));
      setExtractedInfo({ doctor: result.doctor_name, diagnosis: result.diagnosis });
      setPhase("review");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setPhase("upload");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const recordId = await addRecord(
        {
          member_id: selfMemberId,
          type: "prescription",
          title: extractedInfo.doctor
            ? `Prescription — Dr. ${extractedInfo.doctor}`
            : "Scanned Prescription",
          doctor_name: extractedInfo.doctor,
          diagnosis: extractedInfo.diagnosis,
          visit_date: new Date().toISOString().split("T")[0],
          tags: ["onboarding"],
        },
        imageFile ? [imageFile] : undefined
      );

      // Save medicines
      const { db } = await import("@/lib/db/dexie");
      const { v4: uuidv4 } = await import("uuid");
      const now = new Date().toISOString();

      for (const med of extractedMeds) {
        await db.medicines.add({
          id: uuidv4(),
          record_id: recordId,
          member_id: selfMemberId,
          name: med.name,
          dosage: med.dosage,
          frequency: (med.frequency as "once_daily" | "twice_daily" | "thrice_daily") || undefined,
          before_food: med.before_food,
          is_active: true,
          created_at: now,
          updated_at: now,
          sync_status: "pending",
          is_deleted: false,
        });
      }

      toast.success("Prescription saved!");
      onComplete(extractedMeds);
    } catch {
      toast.error("Failed to save. You can try again from the Scan page.");
      onComplete([]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mx-auto mb-2">
          <ScanLine className="h-6 w-6 text-blue-600" />
        </div>
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Step 3 of 4</p>
        <h1 className="text-xl font-bold tracking-tight">
          Scan your first prescription
        </h1>
        <p className="text-sm text-muted-foreground">
          Watch AI extract medicines from any prescription.
        </p>
      </div>

      {phase === "upload" && (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            className="w-full h-14 text-base"
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.setAttribute("capture", "environment");
                fileRef.current.click();
              }
            }}
          >
            <Camera className="h-5 w-5 mr-2" />
            Take Photo
          </Button>
          <Button
            variant="outline"
            className="w-full h-14 text-base"
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.removeAttribute("capture");
                fileRef.current.click();
              }
            }}
          >
            <Upload className="h-5 w-5 mr-2" />
            Upload from Gallery
          </Button>
        </div>
      )}

      {phase === "processing" && (
        <div className="text-center py-8 space-y-4">
          {imagePreview && (
            <div className="w-32 h-32 mx-auto rounded-xl overflow-hidden border">
              <img src={imagePreview} alt="Prescription" className="w-full h-full object-cover" />
            </div>
          )}
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="text-sm font-medium">Analyzing prescription...</p>
            <p className="text-xs text-muted-foreground">AI is extracting medicine details</p>
          </div>
        </div>
      )}

      {phase === "review" && (
        <div className="space-y-3">
          <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                  Found {extractedMeds.length} medicine{extractedMeds.length !== 1 ? "s" : ""}
                </span>
              </div>
              {extractedInfo.doctor && (
                <p className="text-xs text-muted-foreground">Dr. {extractedInfo.doctor}</p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            {extractedMeds.map((med, i) => (
              <Card key={i}>
                <CardContent className="py-2.5 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                    <Pill className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{med.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[med.dosage, med.before_food ? "Before food" : "After food"].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save & Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      )}

      <button
        type="button"
        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        onClick={onSkip}
      >
        Skip for now &rarr;
      </button>

      <StepProgress current={3} total={4} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Set Reminder (skippable)
// ---------------------------------------------------------------------------
function StepReminder({
  selfMemberId,
  selfMemberName,
  suggestedMeds,
  onComplete,
  onSkip,
}: {
  selfMemberId: string;
  selfMemberName: string;
  suggestedMeds: ExtractedMed[];
  onComplete: () => void;
  onSkip: () => void;
}) {
  const { addReminder } = useReminders();
  const [medicineName, setMedicineName] = useState(suggestedMeds[0]?.name || "");
  const [dosage, setDosage] = useState(suggestedMeds[0]?.dosage || "");
  const [time, setTime] = useState("09:00");
  const [beforeFood, setBeforeFood] = useState(suggestedMeds[0]?.before_food ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!medicineName.trim()) {
      toast.error("Please enter a medicine name");
      return;
    }
    setSaving(true);
    try {
      await addReminder({
        medicine_id: "",
        member_id: selfMemberId,
        medicine_name: medicineName.trim(),
        member_name: selfMemberName,
        dosage: dosage || undefined,
        before_food: beforeFood,
        time,
        days: ALL_DAYS,
        is_active: true,
      });
      toast.success("Reminder set! You'll be notified tomorrow.");
      onComplete();
    } catch {
      toast.error("Failed to save reminder");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mx-auto mb-2">
          <Bell className="h-6 w-6 text-amber-600" />
        </div>
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Step 4 of 4</p>
        <h1 className="text-xl font-bold tracking-tight">
          Set a medicine reminder
        </h1>
        <p className="text-sm text-muted-foreground">
          Never miss a dose. We&apos;ll remind you every day.
        </p>
      </div>

      {/* Quick-select from scanned medicines */}
      {suggestedMeds.length > 1 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">From your prescription:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedMeds.map((med, i) => (
              <button
                key={i}
                onClick={() => {
                  setMedicineName(med.name);
                  setDosage(med.dosage || "");
                  setBeforeFood(med.before_food);
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  medicineName === med.name
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border"
                }`}
              >
                {med.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Medicine Name *</Label>
          <Input
            value={medicineName}
            onChange={(e) => setMedicineName(e.target.value)}
            placeholder="e.g. Paracetamol"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Time</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Dosage</Label>
            <Input
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="e.g. 500mg"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={beforeFood ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setBeforeFood(!beforeFood)}
          >
            {beforeFood ? "Before food" : "After food"}
          </Badge>
        </div>
      </div>

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Setting reminder...
          </>
        ) : (
          <>
            Set Reminder & Finish
            <CheckCircle className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>

      <button
        type="button"
        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        onClick={onSkip}
      >
        Skip for now &rarr;
      </button>

      <StepProgress current={4} total={4} />
    </div>
  );
}

// ===========================================================================
// Main Onboarding Page
// ===========================================================================
export default function OnboardingPage() {
  const { user, setUser, setHasCompletedOnboarding } = useAuthStore();
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const { addMember, members } = useMembers();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selfMemberId, setSelfMemberId] = useState<string | null>(null);
  const [selfMemberName, setSelfMemberName] = useState("");
  const [scannedMeds, setScannedMeds] = useState<ExtractedMed[]>([]);
  const [showBadge, setShowBadge] = useState<string | null>(null);

  // ---- Session check + existing-member detection ----
  useEffect(() => {
    let cancelled = false;

    const verifyAndRoute = async () => {
      // Fast path: local flag says onboarded
      if (hasCompletedOnboarding && user) {
        window.location.replace("/home");
        return;
      }

      // Need a session before we can do anything
      let sessionUser = user;
      if (!sessionUser) {
        const supabase = createClient();
        try {
          const { data } = await supabase.auth.getSession();
          const su = data.session?.user;
          if (!su) {
            window.location.replace("/login");
            return;
          }
          sessionUser = {
            id: su.id,
            email: su.email || "",
            name: (su.user_metadata as Record<string, string>)?.name || "",
          };
          if (!cancelled) setUser(sessionUser);
        } catch {
          window.location.replace("/login");
          return;
        }
      }

      // Check Dexie locally first (fast, works offline)
      try {
        const { db } = await import("@/lib/db/dexie");
        const localMembers = await db.members
          .where("user_id")
          .equals(sessionUser.id)
          .toArray();
        const localSelf = localMembers.find(
          (m) => m.relation === "self" && !m.is_deleted
        );
        if (localSelf && !cancelled) {
          setHasCompletedOnboarding(true);
          window.location.replace("/home");
          return;
        }
      } catch {
        // ignore — fall through to server check
      }

      // Check server (for new device / fresh install)
      try {
        const res = await fetch("/api/check-onboarding");
        if (res.ok) {
          const { onboarded } = await res.json();
          if (onboarded && !cancelled) {
            setHasCompletedOnboarding(true);
            window.location.replace("/home");
            return;
          }
        }
      } catch {
        // ignore — show onboarding
      }

      if (!cancelled) setReady(true);
    };

    verifyAndRoute();
    return () => {
      cancelled = true;
    };
  }, [user, hasCompletedOnboarding, setUser, setHasCompletedOnboarding]);

  // ---- Step 1: Save self profile (MANDATORY — marks onboarding complete) ----
  const handleProfileSubmit = async (data: MemberFormData) => {
    setLoading(true);
    try {
      const id = await addMember({ ...data, relation: "self" });
      setSelfMemberId(id);
      setSelfMemberName(data.name);

      // AWAIT sync — ensures the cloud has the self member before we mark
      // onboarding complete. Otherwise the next login may not find them in
      // the cloud and bounce back to onboarding.
      try {
        await syncAll();
      } catch (err) {
        // Don't block onboarding on sync failures (offline-first), but log it
        console.warn("Sync after onboarding failed (will retry):", err);
      }

      setHasCompletedOnboarding(true);
      setShowBadge("Profile Created");
    } catch (err) {
      console.error("Onboarding error:", err);
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 2: Add family member ----
  const handleFamilySubmit = async (data: MemberFormData) => {
    setLoading(true);
    try {
      await addMember(data);
      syncAll().catch(() => {});
      setShowBadge("Family Started");
    } catch {
      toast.error("Failed to add member. You can do this later.");
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 3: Scan complete ----
  const handleScanComplete = (meds: ExtractedMed[]) => {
    setScannedMeds(meds);
    setShowBadge("First Scan");
  };

  // ---- Step 4: Reminder complete ----
  const handleReminderComplete = () => {
    setShowBadge("Never Miss a Dose");
  };

  // ---- Go home ----
  const goHome = () => {
    window.location.replace("/home");
  };

  // ---- Badge dismissed → advance step ----
  const handleBadgeDone = () => {
    setShowBadge(null);
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else if (step === 3) setStep(4);
    else goHome();
  };

  // ---- Loading state ----
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner text="Setting up..." />
      </div>
    );
  }

  // Resolve self member ID if we don't have it yet (for steps 3-4)
  const resolvedSelfId = selfMemberId || members.find((m) => m.relation === "self")?.id || "";

  return (
    <>
      {/* Badge animation overlay */}
      {showBadge && <BadgeUnlocked name={showBadge} onDone={handleBadgeDone} />}

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="MediFamily"
              width={160}
              height={48}
              className="object-contain"
              priority
            />
          </div>

          <div
            key={step}
            className="animate-in fade-in slide-in-from-right-4 duration-300"
          >
            {step === 1 && (
              <StepProfile onSubmit={handleProfileSubmit} />
            )}

            {step === 2 && (
              <StepFamily
                onSubmit={handleFamilySubmit}
                onSkip={() => setStep(3)}
                loading={loading}
              />
            )}

            {step === 3 && (
              <StepScan
                selfMemberId={resolvedSelfId}
                onComplete={handleScanComplete}
                onSkip={() => setStep(4)}
              />
            )}

            {step === 4 && (
              <StepReminder
                selfMemberId={resolvedSelfId}
                selfMemberName={selfMemberName || members.find((m) => m.relation === "self")?.name || ""}
                suggestedMeds={scannedMeds}
                onComplete={handleReminderComplete}
                onSkip={goHome}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
