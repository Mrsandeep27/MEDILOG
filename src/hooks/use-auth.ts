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

    if (!globalSubscription) {
      const supabase = createClient();

      // ALWAYS validate session against Supabase — catches stale localStorage
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
          } else if (useAuthStore.getState().isAuthenticated) {
            // Zustand says authenticated but Supabase has no session — clear stale state
            logout();
          }
        })
        .catch(() => {
          // Network error — if Zustand thinks we're authenticated but we can't verify, clear it
          if (useAuthStore.getState().isAuthenticated) {
            logout();
          }
        });

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
          // No session — clear auth state so user gets redirected to login
          if (useAuthStore.getState().isAuthenticated) {
            logout();
          }
        }
      });

      globalSubscription = subscription;
    }

    return () => {
      subscriberCount--;
      didInit.current = false;
      if (subscriberCount <= 0 && globalSubscription) {
        globalSubscription.unsubscribe();
        globalSubscription = null;
        subscriberCount = 0;
      }
    };
  }, [setUser, logout]);

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
