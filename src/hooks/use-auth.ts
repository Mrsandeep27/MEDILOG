"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";

export function useAuth() {
  const { user, isAuthenticated, setUser, logout } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user: { id: string; email?: string; user_metadata?: Record<string, string>; phone?: string } } | null) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name:
            (session.user.user_metadata as Record<string, string>)?.name || "",
          phone: session.user.phone || "",
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser]);

  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      logout();
    }
  };

  return { user, isAuthenticated, signOut };
}
