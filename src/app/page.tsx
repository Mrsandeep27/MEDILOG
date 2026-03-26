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

        if (user) {
          // Put user in store
          useAuthStore.getState().setUser({
            id: user.id,
            email: user.email || "",
            name: (user.user_metadata as Record<string, string>)?.name || "",
          });

          const onboarded = useAuthStore.getState().hasCompletedOnboarding;
          window.location.replace(onboarded ? "/home" : "/onboarding");
        } else {
          window.location.replace("/login");
        }
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
