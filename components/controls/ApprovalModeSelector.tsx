"use client";

import type { ComponentType } from "react";
import { Shield, ShieldCheck, Zap } from "lucide-react";
import { APPROVAL_MODES, type ApprovalMode } from "@/lib/types";

interface ApprovalModeSelectorProps {
  value: ApprovalMode;
  onChange: (m: ApprovalMode) => void;
}

const ICONS: Record<ApprovalMode, ComponentType<{ size?: number; className?: string }>> = {
  suggest: Shield,
  "auto-edit": ShieldCheck,
  "full-auto": Zap,
};

export function ApprovalModeSelector({
  value,
  onChange,
}: ApprovalModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Approval mode"
      className="flex items-center gap-0.5 rounded-full bg-surface-2 p-0.5"
    >
      {APPROVAL_MODES.map((mode) => {
        const Icon = ICONS[mode.id];
        const active = mode.id === value;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode.id)}
            title={mode.description}
            className={`ds-focus flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-surface text-text shadow-sm"
                : "text-muted hover:text-text"
            }`}
          >
            <Icon
              size={14}
              className={active ? "text-brand" : ""}
            />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
