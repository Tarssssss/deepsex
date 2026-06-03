"use client";

import { Bot, Loader2 } from "lucide-react";
import type { SubAgentRun } from "@/lib/types";
import { Markdown } from "@/components/chat/Markdown";

/** Renders a delegated sub-agent run: its task, live tool count, and result. */
export function SubAgentCard({ run }: { run: SubAgentRun }) {
  return (
    <div className="rounded-[10px] border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-brand-soft text-brand">
          <Bot className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-medium text-text">
          {run.agent ?? "sub-agent"}
        </span>
        {run.status === "running" ? (
          <Loader2 className="ds-spin h-3.5 w-3.5 text-brand" />
        ) : null}
        <span className="ml-auto font-mono text-[11px] text-faint">
          {run.turns} turn{run.turns === 1 ? "" : "s"}
          {run.tools?.length ? ` · ${run.tools.length} tools` : ""}
        </span>
      </div>
      <div className="px-3 py-2">
        <p className="mb-1.5 text-xs text-faint">Task</p>
        <p className="mb-2 text-xs text-muted">{run.task}</p>
        {run.result && (
          <>
            <p className="mb-1 text-xs text-faint">Result</p>
            <div className="text-sm">
              <Markdown>{run.result}</Markdown>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
