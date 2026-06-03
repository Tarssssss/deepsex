"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { MODELS, type DeepSeekModel } from "@/lib/types";

interface ModelSelectorProps {
  value: DeepSeekModel;
  onChange: (m: DeepSeekModel) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = MODELS.find((m) => m.id === value) ?? MODELS[0];

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function select(id: DeepSeekModel) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ds-btn ds-btn-ghost ds-focus h-9 gap-1.5 px-2.5 text-sm font-medium"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current.description}
      >
        <Sparkles size={15} className="text-brand" aria-hidden="true" />
        <span className="text-text">{current.label}</span>
        <ChevronDown
          size={14}
          className={`text-faint transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select model"
          className="ds-card ds-fade-up absolute right-0 z-50 mt-2 w-64 overflow-hidden p-1.5"
        >
          {MODELS.map((m) => {
            const active = m.id === value;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(m.id)}
                className={`ds-focus flex w-full items-start gap-2 rounded-[8px] px-2.5 py-2 text-left transition-colors ${
                  active
                    ? "bg-brand-soft"
                    : "hover:bg-surface-2"
                }`}
              >
                <Check
                  size={15}
                  className={`mt-0.5 shrink-0 ${
                    active ? "text-brand" : "text-transparent"
                  }`}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text">
                    {m.label}
                  </span>
                  <span className="block text-xs text-muted">
                    {m.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
