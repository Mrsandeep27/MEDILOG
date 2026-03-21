"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";

export function useAuth() {
  const { user, isAuthenticated, setUser, logout } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.name || "",
          phone: session.user.phone || "",
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.name || "",
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
    const supabase = createClient();
    await supabase.auth.signOut();
    logout();
  };

  return {
    user,
    isAuthenticated,
    signOut,
  };
}
