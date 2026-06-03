"use client";

import { Circle, CircleDot, CheckCircle2, ListTodo } from "lucide-react";
import type { PlanStep } from "@/lib/types";

/**
 * Renders a Codex-style live TODO checklist (the update_plan tool).
 * `compact` is used for the standalone panel above the composer.
 */
export function PlanView({
  steps,
  compact,
}: {
  steps: PlanStep[];
  compact?: boolean;
}) {
  if (!steps.length) return null;
  const done = steps.filter((s) => s.status === "completed").length;

  return (
    <div className={compact ? "" : "rounded-[10px] border border-border bg-surface p-3"}>
      {!compact && (
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-faint">
          <ListTodo className="h-3.5 w-3.5" />
          Plan
          <span className="ml-auto font-mono text-[11px] normal-case tracking-normal text-muted">
            {done}/{steps.length}
          </span>
        </div>
      )}
      <ul className="flex flex-col gap-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <StepIcon status={s.status} />
            <span
              className={
                s.status === "completed"
                  ? "text-faint line-through"
                  : s.status === "in_progress"
                    ? "text-text"
                    : "text-muted"
              }
            >
              {s.step}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepIcon({ status }: { status: PlanStep["status"] }) {
  if (status === "completed")
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />;
  if (status === "in_progress")
    return <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-brand ds-shimmer" />;
  return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-faint" />;
}
