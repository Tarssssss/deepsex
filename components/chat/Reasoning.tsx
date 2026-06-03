"use client";

import { useState } from "react";
import { ChevronRight, Brain } from "lucide-react";

/**
 * Collapsible "Thinking" panel for deepseek-reasoner chain-of-thought.
 * Collapsed by default. Subtle and unobtrusive.
 */
export function Reasoning({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="ds-focus flex items-center gap-1.5 rounded-[var(--radius-sm)] py-1 text-xs font-medium text-muted transition-colors hover:text-text"
      >
        <Brain
          className={`h-3.5 w-3.5 text-faint ${streaming ? "ds-shimmer" : ""}`}
        />
        <span className={streaming ? "ds-shimmer" : ""}>
          Thinking{streaming ? "…" : ""}
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 text-faint transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-1.5 border-l-2 border-border-strong pl-3 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-muted">
          {text}
          {streaming && <span className="ds-cursor" />}
        </div>
      )}
    </div>
  );
}
