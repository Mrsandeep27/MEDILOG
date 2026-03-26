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
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated || didRun.current) return;
    didRun.current = true;

    const init = async () => {
      const { hasCompletedOnboarding, isAuthenticated } =
        useAuthStore.getState();

      // Already authenticated in Zustand — route immediately
      if (isAuthenticated) {
        router.replace(hasCompletedOnboarding ? "/home" : "/onboarding");
        return;
      }

      // Not in Zustand — check Supabase session
      try {
        const supabase = createClient();
        const {
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
        } = await supabase.auth.getSession();
        const user = data.session?.user;

        if (user) {
          setUser({
            id: user.id,
            email: user.email || "",
            name: user.user_metadata?.name || "",
          });
          const onboarded = useAuthStore.getState().hasCompletedOnboarding;
          router.replace(onboarded ? "/home" : "/onboarding");
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
    };

    init();
  }, [hasHydrated, router, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading MediLog..." />
    </div>
  );
}
