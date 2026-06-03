"use client";

/**
 * Theme helper shared by routes that don't use the main `useAgent` hook (e.g.
 * the /agents page). Theme preference lives in the persisted settings object
 * (`ds-settings`), so changing it here stays in sync with the main app.
 */
import { useEffect, useState } from "react";
import type { ThemePref } from "@/lib/types";
import { loadSettings, saveSettings } from "@/lib/storage";

export function applyTheme(pref: ThemePref): void {
  if (typeof document === "undefined") return;
  const resolved =
    pref === "system"
      ? window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : pref;
  document.documentElement.dataset.theme = resolved;
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemePref>("system");

  useEffect(() => {
    const s = loadSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(s.theme);
    applyTheme(s.theme);
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (loadSettings().theme === "system") applyTheme("system");
    };
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  const change = (t: ThemePref) => {
    setTheme(t);
    saveSettings({ ...loadSettings(), theme: t });
    applyTheme(t);
  };

  return { theme, setTheme: change };
}
