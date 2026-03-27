import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
}

interface AuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  setUser: (user: AppUser | null) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      setUser: (user) =>
        set((state) => ({
          user,
          isAuthenticated: !!user,
          // Reset onboarding flag when a different user logs in (shared device)
          hasCompletedOnboarding:
            user && state.user && state.user.id !== user.id
              ? false
              : state.hasCompletedOnboarding,
        })),
      setHasCompletedOnboarding: (value) =>
        set({ hasCompletedOnboarding: value }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          // Keep hasCompletedOnboarding so returning user skips onboarding
        }),
    }),
    {
      name: "medilog-auth",
    }
  )
);
