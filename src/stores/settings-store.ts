import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  // PIN Lock
  pinEnabled: boolean;
  pinHash: string | null;
  lastActiveAt: number;

  // Preferences
  language: "en" | "hi";

  // Notifications
  notificationsEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;

  // Sync
  lastSyncAt: string | null;
  syncCursor: string | null;

  // Actions
  setPinEnabled: (enabled: boolean) => void;
  setPinHash: (hash: string | null) => void;
  setLastActiveAt: (timestamp: number) => void;
  setLanguage: (language: "en" | "hi") => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setQuietHours: (enabled: boolean, start?: string, end?: string) => void;
  setLastSyncAt: (timestamp: string | null) => void;
  setSyncCursor: (cursor: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      pinEnabled: false,
      pinHash: null,
      lastActiveAt: Date.now(),
      language: "en",
      notificationsEnabled: true,
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      lastSyncAt: null,
      syncCursor: null,

      setPinEnabled: (enabled) => set({ pinEnabled: enabled }),
      setPinHash: (hash) => set({ pinHash: hash }),
      setLastActiveAt: (timestamp) => set({ lastActiveAt: timestamp }),
      setLanguage: (language) => set({ language }),
      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),
      setQuietHours: (enabled, start, end) =>
        set((state) => ({
          quietHoursEnabled: enabled,
          quietHoursStart: start ?? state.quietHoursStart,
          quietHoursEnd: end ?? state.quietHoursEnd,
        })),
      setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),
      setSyncCursor: (cursor) => set({ syncCursor: cursor }),
    }),
    {
      name: "medifamily-settings",
    }
  )
);
