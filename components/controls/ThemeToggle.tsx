"use client";

import { Moon, Sun, MonitorSmartphone } from "lucide-react";
import type { ThemePref } from "@/lib/types";

/**
 * Theme cycle button: light → dark → system → light.
 * Theme is owned by agent settings (persisted there); this is just a control.
 */
export function ThemeToggle({
  value,
  onChange,
}: {
  value: ThemePref;
  onChange: (t: ThemePref) => void;
}) {
  const next: Record<ThemePref, ThemePref> = {
    light: "dark",
    dark: "system",
    system: "light",
  };

  const Icon = value === "dark" ? Sun : value === "system" ? MonitorSmartphone : Moon;
  const label =
    value === "light"
      ? "Light theme (click for dark)"
      : value === "dark"
        ? "Dark theme (click for system)"
        : "System theme (click for light)";

  return (
    <button
      type="button"
      onClick={() => onChange(next[value])}
      className="ds-btn ds-btn-ghost ds-focus h-9 w-9 p-0"
      aria-label={label}
      title={label}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
