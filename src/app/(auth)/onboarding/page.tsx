"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useMembers } from "@/hooks/use-members";
import { MemberForm } from "@/components/family/member-form";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import type { MemberFormData } from "@/lib/utils/validators";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db/dexie";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setUser, setHasCompletedOnboarding } = useAuthStore();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const { addMember } = useMembers();
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;

    // If already completed onboarding, go to home (don't show form again)
    if (hasCompletedOnboarding && user) {
      router.replace("/home");
      return;
    }

    if (user) {
      // Check if user already has a "self" member in Dexie
      // (could have been synced from another device)
      db.members
        .where({ user_id: user.id, is_deleted: false })
        .filter((m) => m.relation === "self")
        .first()
        .then((selfMember) => {
          if (selfMember) {
            // Already onboarded on another device — skip
            setHasCompletedOnboarding(true);
            router.replace("/home");
          } else {
            setAuthReady(true);
          }
        })
        .catch(() => {
          setAuthReady(true);
        });
      return;
    }

    // No user — check Supabase session (user just verified email)
    const init = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user;
        if (sessionUser) {
          setUser({
            id: sessionUser.id,
            email: sessionUser.email || "",
            name: (sessionUser.user_metadata as Record<string, string>)?.name || "",
          });
          // setUser will trigger re-run of this effect to check Dexie
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
    };
    init();
  }, [hasHydrated, user, hasCompletedOnboarding, setUser, setHasCompletedOnboarding, router]);

  const handleSubmit = async (data: MemberFormData) => {
    setLoading(true);
    try {
      await addMember({ ...data, relation: "self" });
      setHasCompletedOnboarding(true);
      toast.success("Welcome to MediLog!");
      router.replace("/home");
    } catch (err) {
      console.error("Onboarding error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
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
