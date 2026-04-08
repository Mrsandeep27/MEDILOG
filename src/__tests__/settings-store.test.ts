import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "@/stores/settings-store";

describe("Settings Store", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      pinEnabled: false,
      pinHash: null,
      notificationsEnabled: true,
      language: "en",
      lastActiveAt: Date.now(),
    });
  });

  it("starts with PIN disabled", () => {
    const state = useSettingsStore.getState();
    expect(state.pinEnabled).toBe(false);
    expect(state.pinHash).toBeNull();
  });

  it("enables PIN with hash", () => {
    useSettingsStore.getState().setPinEnabled(true);
    useSettingsStore.getState().setPinHash("abcdef123456");
    const state = useSettingsStore.getState();
    expect(state.pinEnabled).toBe(true);
    expect(state.pinHash).toBe("abcdef123456");
  });

  it("disables PIN", () => {
    useSettingsStore.getState().setPinEnabled(true);
    useSettingsStore.getState().setPinHash("hash123");
    useSettingsStore.getState().setPinEnabled(false);
    useSettingsStore.getState().setPinHash(null);
    const state = useSettingsStore.getState();
    expect(state.pinEnabled).toBe(false);
    expect(state.pinHash).toBeNull();
  });

  it("toggles notifications", () => {
    useSettingsStore.getState().setNotificationsEnabled(false);
    expect(useSettingsStore.getState().notificationsEnabled).toBe(false);
    useSettingsStore.getState().setNotificationsEnabled(true);
    expect(useSettingsStore.getState().notificationsEnabled).toBe(true);
  });

  it("changes language", () => {
    useSettingsStore.getState().setLanguage("hi");
    expect(useSettingsStore.getState().language).toBe("hi");
  });

  it("updates last active timestamp", () => {
    const before = Date.now();
    useSettingsStore.getState().setLastActiveAt(before);
    expect(useSettingsStore.getState().lastActiveAt).toBe(before);
  });
});
