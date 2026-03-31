"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useMembers } from "@/hooks/use-members";
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
  HeartPulse,
  Share2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------
function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {[1, 2, 3].map((s) => (
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
// Step 1 - Welcome
// ---------------------------------------------------------------------------
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center space-y-6">
      <Image
        src="/logo.png"
        alt="MediLog"
        width={200}
        height={60}
        className="object-contain"
        priority
      />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome to MediLog
        </h1>
        <p className="text-sm text-muted-foreground">
          Your family&apos;s health, always at hand.
        </p>
      </div>

      <div className="w-full space-y-3">
        {[
          {
            icon: Shield,
            text: "Store health records offline & securely",
          },
          {
            icon: Users,
            text: "Manage health for your entire family",
          },
          {
            icon: ScanLine,
            text: "AI-powered prescription scanning",
          },
        ].map(({ icon: Icon, text }) => (
          <Card key={text} className="border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-left">{text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button className="w-full" size="lg" onClick={onNext}>
        Get Started
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      <StepProgress current={1} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 - Profile form
// ---------------------------------------------------------------------------
function StepProfile({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (data: MemberFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold tracking-tight">
          Create Your Health Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          This helps personalize your experience
        </p>
      </div>

      <MemberForm
        onSubmit={onSubmit}
        submitLabel="Continue"
        defaultRelation="self"
        hideRelation
      />

      <Button
        variant="ghost"
        className="w-full"
        onClick={onBack}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <StepProgress current={2} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 - Quick tour
// ---------------------------------------------------------------------------
function StepTour({
  onFinish,
  loading,
}: {
  onFinish: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center space-y-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle className="h-7 w-7" />
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          You&apos;re All Set!
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what you can do with MediLog
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {[
          {
            icon: ScanLine,
            title: "Scan Prescription",
            desc: "Point camera at any prescription",
          },
          {
            icon: Bell,
            title: "Medicine Reminders",
            desc: "Never miss a dose",
          },
          {
            icon: HeartPulse,
            title: "Track Symptoms",
            desc: "Log daily health & mood",
          },
          {
            icon: Share2,
            title: "Share with Doctor",
            desc: "Secure QR sharing",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="border-border/60">
            <CardContent className="flex flex-col items-center gap-2 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold leading-tight">{title}</p>
              <p className="text-xs text-muted-foreground leading-tight">
                {desc}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="w-full space-y-2">
        <Button
          className="w-full"
          size="lg"
          onClick={onFinish}
          disabled={loading}
        >
          {loading ? "Saving..." : "Start Using MediLog"}
          {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>

        <button
          type="button"
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
          onClick={onFinish}
          disabled={loading}
        >
          Skip Tour
        </button>
      </div>

      <StepProgress current={3} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function OnboardingPage() {
  const { user, setUser, setHasCompletedOnboarding } = useAuthStore();
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const { addMember } = useMembers();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [profileData, setProfileData] = useState<MemberFormData | null>(null);

  // ---- Session check (kept exactly as-is) ----
  useEffect(() => {
    // Already onboarded -> go home
    if (hasCompletedOnboarding && user) {
      window.location.replace("/home");
      return;
    }

    // Already have user in store -> show form
    if (user) {
      setReady(true);
      return;
    }

    // No user in store -> check Supabase (user just clicked verify link)
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(
        ({
          data,
        }: {
          data: {
            session: {
              user: {
                id: string;
                email?: string;
                user_metadata?: Record<string, string>;
              };
            } | null;
          };
        }) => {
          const sessionUser = data.session?.user;
          if (sessionUser) {
            setUser({
              id: sessionUser.id,
              email: sessionUser.email || "",
              name:
                (sessionUser.user_metadata as Record<string, string>)?.name ||
                "",
            });
            setReady(true);
          } else {
            window.location.replace("/login");
          }
        },
      )
      .catch(() => {
        window.location.replace("/login");
      });
  }, [user, hasCompletedOnboarding, setUser]);

  // ---- Save handler (step 3 finish) ----
  const handleFinish = async () => {
    if (!profileData) return;
    setLoading(true);
    try {
      await addMember({ ...profileData, relation: "self" });
      setHasCompletedOnboarding(true);
      toast.success("Welcome to MediLog!");

      // Immediately sync to Supabase so other devices can detect onboarding
      syncAll().catch(() => {
        /* best-effort, don't block navigation */
      });

      window.location.replace("/home");
    } catch (err) {
      console.error("Onboarding error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Loading state ----
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner text="Setting up..." />
      </div>
    );
  }

  // ---- Render current step with transition ----
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div
          key={step}
          className="animate-in fade-in slide-in-from-right-4 duration-300"
        >
          {step === 1 && <StepWelcome onNext={() => setStep(2)} />}

          {step === 2 && (
            <StepProfile
              onBack={() => setStep(1)}
              onSubmit={(data) => {
                setProfileData(data);
                setStep(3);
              }}
            />
          )}

          {step === 3 && (
            <StepTour onFinish={handleFinish} loading={loading} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
