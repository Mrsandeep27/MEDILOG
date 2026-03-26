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
  _hasHydrated: boolean;
  setUser: (user: AppUser | null) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      _hasHydrated: false,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),
      setHasCompletedOnboarding: (value) =>
        set({ hasCompletedOnboarding: value }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          hasCompletedOnboarding: false,
        }),
      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: "medilog-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
      onRehydrateStorage: () => {
        return () => {
          // This callback fires AFTER persist has finished hydrating from localStorage
          useAuthStore.getState().setHasHydrated(true);
        };
      },
    }
  )
);
