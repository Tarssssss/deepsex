"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Gauge } from "lucide-react";
import { REASONING_EFFORTS, type ReasoningEffort } from "@/lib/types";

/** Codex-style reasoning-effort selector (minimal → high). */
export function EffortSelector({
  value,
  onChange,
}: {
  value: ReasoningEffort;
  onChange: (e: ReasoningEffort) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = REASONING_EFFORTS.find((e) => e.id === value) ?? REASONING_EFFORTS[2];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ds-btn ds-btn-ghost ds-focus h-9 gap-1.5 px-2.5 text-sm font-medium"
        title={`Reasoning effort: ${current.description}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Gauge size={15} className="text-brand" aria-hidden="true" />
        <span className="hidden text-text sm:inline">{current.label}</span>
        <ChevronDown
          size={14}
          className={`text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Reasoning effort"
          className="ds-card ds-fade-up absolute right-0 z-50 mt-2 w-60 overflow-hidden p-1.5"
        >
          {REASONING_EFFORTS.map((e) => {
            const active = e.id === value;
            return (
              <button
                key={e.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(e.id);
                  setOpen(false);
                }}
                className={`ds-focus flex w-full items-start gap-2 rounded-[8px] px-2.5 py-2 text-left transition-colors ${
                  active ? "bg-brand-soft" : "hover:bg-surface-2"
                }`}
              >
                <Check
                  size={15}
                  className={`mt-0.5 shrink-0 ${active ? "text-brand" : "text-transparent"}`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text">{e.label}</span>
                  <span className="block text-xs text-muted">{e.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
