"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/common/loading-spinner";

export default function RootPage() {
  useEffect(() => {
    const go = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;

        if (!user) {
          window.location.replace("/login");
          return;
        }

        // Put user in store
        useAuthStore.getState().setUser({
          id: user.id,
          email: user.email || "",
          name: (user.user_metadata as Record<string, string>)?.name || "",
        });

        // Check localStorage first (fast path)
        if (useAuthStore.getState().hasCompletedOnboarding) {
          window.location.replace("/home");
          return;
        }

        // localStorage says not onboarded — ask the server
        // (handles existing user on a new device)
        try {
          const res = await fetch("/api/check-onboarding");
          const { onboarded } = await res.json();
          if (onboarded) {
            useAuthStore.getState().setHasCompletedOnboarding(true);
            window.location.replace("/home");
            return;
          }
        } catch {
          // Server check failed — fall through to onboarding
        }

        window.location.replace("/onboarding");
      } catch {
        window.location.replace("/login");
      }
    };

    go();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediLog..." />
    </div>
  );
}
