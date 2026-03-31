"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useMembers } from "@/hooks/use-members";
import { MemberForm } from "@/components/family/member-form";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import type { MemberFormData } from "@/lib/utils/validators";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { syncAll } from "@/lib/db/sync";

export default function OnboardingPage() {
  const { user, setUser, setHasCompletedOnboarding } = useAuthStore();
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const { addMember } = useMembers();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Already onboarded → go home
    if (hasCompletedOnboarding && user) {
      window.location.replace("/home");
      return;
    }

    // Already have user in store → show form
    if (user) {
      setReady(true);
      return;
    }

    // No user in store → check Supabase (user just clicked verify link)
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }: { data: { session: { user: { id: string; email?: string; user_metadata?: Record<string, string> } } | null } }) => {
      const sessionUser = data.session?.user;
      if (sessionUser) {
        setUser({
          id: sessionUser.id,
          email: sessionUser.email || "",
          name: (sessionUser.user_metadata as Record<string, string>)?.name || "",
        });
        setReady(true);
      } else {
        window.location.replace("/login");
      }
    }).catch(() => {
      window.location.replace("/login");
    });
  }, [user, hasCompletedOnboarding, setUser]);

  const handleSubmit = async (data: MemberFormData) => {
    setLoading(true);
    try {
      await addMember({ ...data, relation: "self" });
      setHasCompletedOnboarding(true);
      toast.success("Welcome to MediLog!");

      // Immediately sync to Supabase so other devices can detect onboarding
      syncAll().catch(() => {/* best-effort, don't block navigation */});

      window.location.replace("/home");
    } catch (err) {
      console.error("Onboarding error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner text="Setting up..." />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center space-y-2 pb-2">
        <div className="mx-auto">
          <Image
            src="/logo.png"
            alt="MediLog"
            width={240}
            height={72}
            className="mx-auto object-contain"
            style={{ marginTop: "-20px", marginBottom: "-20px" }}
            priority
          />
        </div>
        <h1 className="text-xl font-bold">Welcome to MediLog</h1>
        <p className="text-sm text-muted-foreground">
          Set up your profile to get started. Fields marked * are important.
        </p>
      </CardHeader>
      <CardContent>
        <MemberForm
          onSubmit={handleSubmit}
          loading={loading}
          submitLabel="Get Started"
          defaultRelation="self"
          hideRelation
        />
      </CardContent>
    </Card>
  );
}
