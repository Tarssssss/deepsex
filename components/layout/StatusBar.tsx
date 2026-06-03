import {
  APPROVAL_MODES,
  MODELS,
  type ApprovalMode,
  type DeepSeekModel,
} from "@/lib/types";

interface StatusBarProps {
  status: string;
  model: DeepSeekModel;
  approvalMode: ApprovalMode;
}

/** Heuristic: treat anything that isn't an explicit idle/ready state as busy. */
function isBusy(status: string): boolean {
  const s = status.trim().toLowerCase();
  return !(s === "" || s === "idle" || s === "ready" || s === "done");
}

export function StatusBar({ status, model, approvalMode }: StatusBarProps) {
  const busy = isBusy(status);
  const modelLabel = MODELS.find((m) => m.id === model)?.label ?? model;
  const approvalLabel =
    APPROVAL_MODES.find((a) => a.id === approvalMode)?.label ?? approvalMode;

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
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <span className="text-faint">
          Model <span className="text-muted">{modelLabel}</span>
        </span>
        <span className="text-faint">
          Approval <span className="text-muted">{approvalLabel}</span>
        </span>
      </div>
    </div>
  );
}
