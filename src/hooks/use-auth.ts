"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";

// Global subscription reference — prevents double subscriptions in React Strict Mode
let globalSubscription: { unsubscribe: () => void } | null = null;
let subscriberCount = 0;

export function useAuth() {
  const { user, isAuthenticated, setUser, logout } = useAuthStore();
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    subscriberCount++;

    // Only set up listener if no global subscription exists
    if (!globalSubscription) {
      const supabase = createClient();

      // Only call getSession if Zustand doesn't already have a user
      const zustandUser = useAuthStore.getState().user;
      if (!zustandUser) {
        supabase.auth
          .getSession()
          .then(({ data }: { data: { session: { user: { id: string; email?: string; user_metadata?: Record<string, string>; phone?: string } } | null } }) => {
            const u = data.session?.user;
            if (u) {
              setUser({
                id: u.id,
                email: u.email || "",
                name: (u.user_metadata as Record<string, string>)?.name || "",
                phone: u.phone || "",
              });
            }
          })
          .catch(() => {});
      }

      // One listener for auth state changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event: string, session: { user: { id: string; email?: string; user_metadata?: Record<string, string>; phone?: string } } | null) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            name:
              (session.user.user_metadata as Record<string, string>)?.name ||
              "",
            phone: session.user.phone || "",
          });
        } else {
          setUser(null);
        }
      });

      globalSubscription = subscription;
    }

    return () => {
      subscriberCount--;
      didInit.current = false;
      // Only unsubscribe when ALL instances are unmounted
      if (subscriberCount <= 0 && globalSubscription) {
        globalSubscription.unsubscribe();
        globalSubscription = null;
        subscriberCount = 0;
      }
    };
  }, [setUser]);

  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      if (globalSubscription) {
        globalSubscription.unsubscribe();
        globalSubscription = null;
      }
      subscriberCount = 0;
      logout();
    }
  };

  return {
    user,
    isAuthenticated,
    signOut,
  };
}
