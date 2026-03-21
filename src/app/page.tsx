"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/common/loading-spinner";

export default function RootPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const { hasCompletedOnboarding, isAuthenticated } = useAuthStore.getState();
    const supabase = createClient();

    supabase.auth
      .getSession()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data: { session } }: any) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            name: session.user.user_metadata?.name || "",
          });
          router.replace(hasCompletedOnboarding ? "/home" : "/onboarding");
        } else if (isAuthenticated && hasCompletedOnboarding) {
          router.replace("/home");
        } else {
          router.replace("/login");
        }
      })
      .catch(() => {
        // Offline or network error
        if (isAuthenticated && hasCompletedOnboarding) {
          router.replace("/home");
        } else {
          router.replace("/login");
        }
      });
  }, [router, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediLog..." />
    </div>
  );
}
