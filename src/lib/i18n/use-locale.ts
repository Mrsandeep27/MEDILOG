"use client";

import { useCallback } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { t, type Locale } from "./translations";

export function useLocale() {
  const rawLanguage = useSettingsStore((s) => s.language);
  const locale: Locale = rawLanguage === "hi" ? "hi" : "en";

  const translate = useCallback(
    (key: string) => t(key, locale),
    [locale]
  );

  return {
    locale,
    t: translate,
  };
}
