"use client";

import { useEffect, useState, Component, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationChecker } from "@/hooks/use-notification-checker";
import { BottomNav } from "@/components/layout/bottom-nav";
import { OfflineIndicator } from "@/components/layout/offline-indicator";
import { PinLockScreen } from "@/components/layout/pin-lock-screen";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = "/home";
            }}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            Go to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppLayout({ children }: { children: ReactNode }) {
  useAuth();
  useNotificationChecker();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Request persistent storage so browser won't auto-purge IndexedDB
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }

    // One-time session check — if no session, kick to login
    // Falls back to cached Zustand session when offline
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }: { data: { session: { user: { id: string; email?: string; email_confirmed_at?: string | null; user_metadata?: Record<string, string> } } | null } }) => {
      if (!data.session) {
        // No active session — but check if we're offline with cached auth
        if (!navigator.onLine && useAuthStore.getState().user) {
          setChecked(true);
          return;
        }
        window.location.replace("/login");
      } else {
        const sessionUser = data.session.user;

        // Enforce email verification — unverified users cannot access the app
        if (!sessionUser.email_confirmed_at) {
          supabase.auth.signOut();
          toast.error("Please verify your email before accessing the app.");
          window.location.replace("/login");
          return;
        }

        // Sync store with real session — fix stale/missing user data
        const store = useAuthStore.getState();
        if (!store.user || store.user.id !== sessionUser.id) {
          store.setUser({
            id: sessionUser.id,
            email: sessionUser.email || "",
            name: (sessionUser.user_metadata as Record<string, string>)?.name || "",
          });
        }
        setChecked(true);

        // Show review nudge once per session
        if (!sessionStorage.getItem("review-nudge-shown")) {
          sessionStorage.setItem("review-nudge-shown", "1");
          setTimeout(() => {
            toast("🚧 This app is under development!", {
              description: "Your review will help make the experience much better. Please share your feedback in the Review box under More → Feedback.",
              duration: 8000,
              action: {
                label: "Review Now",
                onClick: () => { window.location.href = "/more/feedback"; },
              },
            });
          }, 2000);
        }
      }
    }).catch(() => {
      // Network error — if we have cached user, let them use the app offline
      if (!navigator.onLine && useAuthStore.getState().user) {
        setChecked(true);
        return;
      }
      window.location.replace("/login");
    });
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      <PinLockScreen />
      <ErrorBoundary>
        <main className="pb-20">{children}</main>
      </ErrorBoundary>
      <BottomNav />
    </div>
  );
}
