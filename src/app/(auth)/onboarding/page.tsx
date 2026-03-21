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

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setUser, setHasCompletedOnboarding } = useAuthStore();
  const { addMember } = useMembers();
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(!!user);

  // Sync Supabase session into Zustand (in case user just verified email)
  useEffect(() => {
    if (user) {
      setAuthReady(true);
      return;
    }

    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            name: session.user.user_metadata?.name || "",
          });
        } else {
          // Not logged in, redirect to login
          router.replace("/login");
        }
      })
      .catch(() => {
        router.replace("/login");
      })
      .finally(() => {
        setAuthReady(true);
      });
  }, [user, setUser, router]);

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
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto">
          <Image
            src="/logo.png"
            alt="MediLog"
            width={180}
            height={54}
            className="mx-auto"
            priority
          />
        </div>
        <h1 className="text-xl font-bold">Welcome to MediLog</h1>
        <p className="text-sm text-muted-foreground">
          Let&apos;s set up your profile to get started
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
