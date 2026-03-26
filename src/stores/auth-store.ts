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
  _onboardedUserId: string | null;
  _hasHydrated: boolean;
  setUser: (user: AppUser | null) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      _onboardedUserId: null,
      _hasHydrated: false,
      setUser: (user) => {
        const lastId = get()._onboardedUserId;
        const newId = user?.id ?? null;
        // If a different user logs in, reset onboarding
        const switchedUser = lastId && newId && lastId !== newId;
        set({
          user,
          isAuthenticated: !!user,
          ...(switchedUser ? { hasCompletedOnboarding: false, _onboardedUserId: null } : {}),
        });
      },
      setHasCompletedOnboarding: (value) =>
        set({
          hasCompletedOnboarding: value,
          _onboardedUserId: value ? get().user?.id ?? null : null,
        }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          // Keep hasCompletedOnboarding + _onboardedUserId so same user skips onboarding on re-login
        }),
      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: "medilog-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        _onboardedUserId: state._onboardedUserId,
      }),
      onRehydrateStorage: () => {
        return () => {
          useAuthStore.getState().setHasHydrated(true);
        };
      },
    }
  )
);
