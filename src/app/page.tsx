"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/common/loading-spinner";

function getStoredOnboarding(): boolean {
  try {
    const raw = localStorage.getItem("medilog-auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.hasCompletedOnboarding === true;
    }
  } catch {
    // ignore
  }
  return false;
}

export default function RootPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const supabase = createClient();

        // Race against a 5s timeout so the page never hangs forever
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);

        if (cancelled) return;

        const user = result?.data?.session?.user;
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
        if (!cancelled) router.replace("/login");
      }
    };

    init();
    return () => { cancelled = true; };
  }, [router, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediLog..." />
    </div>
  );
}
