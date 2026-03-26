"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/common/loading-spinner";

// Read onboarding state directly from localStorage — bypasses Zustand hydration issues
function getStoredOnboarding(): boolean {
  try {
    const raw = localStorage.getItem("medilog-auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.hasCompletedOnboarding === true;
    }
  } catch {
    // Corrupted localStorage — ignore
  }
  return false;
}

export default function RootPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const init = async () => {
      // Check Supabase session directly — single source of truth
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;

        if (user) {
          setUser({
            id: user.id,
            email: user.email || "",
            name: (user.user_metadata as Record<string, string>)?.name || "",
          });
          const onboarded = getStoredOnboarding();
          router.replace(onboarded ? "/home" : "/onboarding");
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
    };

    init();
  }, [router, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediLog..." />
    </div>
  );
}
