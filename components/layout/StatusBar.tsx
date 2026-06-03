"use client";

import { Activity, Target } from "lucide-react";
import {
  APPROVAL_MODES,
  MODELS,
  REASONING_EFFORTS,
  type ApprovalMode,
  type DeepSeekModel,
  type ReasoningEffort,
  type UsageTotals,
} from "@/lib/types";

interface StatusBarProps {
  status: string;
  model: DeepSeekModel;
  approvalMode: ApprovalMode;
  reasoningEffort: ReasoningEffort;
  usage: UsageTotals;
  goalMode?: boolean;
  goalIteration?: number;
  onShowUsage?: () => void;
}

function isBusy(status: string): boolean {
  const s = status.trim().toLowerCase();
  return !(s === "" || s === "idle" || s === "ready" || s === "done");
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function StatusBar({
  status,
  model,
  approvalMode,
  reasoningEffort,
  usage,
  goalMode,
  goalIteration,
  onShowUsage,
}: StatusBarProps) {
  const busy = isBusy(status);
  const modelLabel = MODELS.find((m) => m.id === model)?.label ?? model;
  const approvalLabel =
    APPROVAL_MODES.find((a) => a.id === approvalMode)?.label ?? approvalMode;
  const effortLabel =
    REASONING_EFFORTS.find((e) => e.id === reasoningEffort)?.label ?? reasoningEffort;

  return (
    <div className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-border bg-surface px-3 text-xs text-muted">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${
            busy ? "bg-warning ds-shimmer" : "bg-success"
          }`}
        />
        <span className="truncate">{status || "Idle"}</span>
        {goalMode && (
          <span className="flex items-center gap-1 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand">
            <Target size={11} />
            Goal{goalIteration ? ` ${goalIteration}` : ""}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <button
          type="button"
          onClick={onShowUsage}
          className="ds-focus flex items-center gap-1.5 rounded-[6px] px-1 hover:text-text"
          title="Session usage"
        >
          <Activity size={12} />
          <span className="font-mono">{fmt(usage.total_tokens)}</span>
          {usage.costUsd > 0 && (
            <span className="text-faint">${usage.costUsd.toFixed(3)}</span>
          )}
        </button>
        <span className="hidden text-faint sm:inline">
          Effort <span className="text-muted">{effortLabel}</span>
        </span>
        <span className="hidden text-faint md:inline">
          Model <span className="text-muted">{modelLabel}</span>
        </span>
        <span className="hidden text-faint lg:inline">
          Approval <span className="text-muted">{approvalLabel}</span>
        </span>
      </div>
    </div>
  );
}
