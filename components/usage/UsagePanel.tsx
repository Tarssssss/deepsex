"use client";

import { Activity, X } from "lucide-react";
import {
  MODELS,
  type DeepSeekModel,
  type UsageTotals,
} from "@/lib/types";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function usd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "$" + n.toFixed(4);
  return "$" + n.toFixed(3);
}

/**
 * Token + cost visualization for the current session, highlighting DeepSeek's
 * context-cache hit rate (the main cost/latency lever in an agent loop).
 */
export function UsagePanel({
  usage,
  model,
  onClose,
}: {
  usage: UsageTotals;
  model: DeepSeekModel;
  onClose: () => void;
}) {
  const info = MODELS.find((m) => m.id === model) ?? MODELS[0];
  const hit = usage.prompt_cache_hit_tokens ?? 0;
  const miss =
    usage.prompt_cache_miss_tokens ?? Math.max(0, usage.prompt_tokens - hit);
  const hitRate = usage.prompt_tokens > 0 ? (hit / usage.prompt_tokens) * 100 : 0;
  const ctxPct = Math.min(
    100,
    (usage.prompt_tokens / info.contextWindow) * 100
  );

  // Cost saved vs. if every input token had been a cache miss.
  const savedUsd =
    (hit / 1_000_000) * (info.pricing.cacheMiss - info.pricing.cacheHit);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[color:var(--overlay)]" onClick={onClose} />
      <div className="ds-card ds-fade-up relative z-10 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-text">Session usage</span>
          </div>
          <button className="ds-btn ds-btn-ghost ds-focus !p-1.5" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Input" value={fmt(usage.prompt_tokens)} />
            <Stat label="Output" value={fmt(usage.completion_tokens)} />
            <Stat label="Total" value={fmt(usage.total_tokens)} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted">Cache hit rate</span>
              <span className="font-mono text-text">{hitRate.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{ width: `${hitRate}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-faint">
              {fmt(hit)} cached · {fmt(miss)} fresh
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted">Context window</span>
              <span className="font-mono text-text">
                {ctxPct < 1 ? "<1" : ctxPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${Math.max(ctxPct, 1)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-faint">
              of {fmt(info.contextWindow)} tokens
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
            <Stat label="Turns" value={String(usage.turns)} />
            <Stat label="Est. cost" value={usd(usage.costUsd)} />
            <Stat label="Saved" value={usd(savedUsd)} accent />
          </div>

          {(usage.reasoning_tokens ?? 0) > 0 && (
            <p className="text-[11px] text-faint">
              Includes {fmt(usage.reasoning_tokens ?? 0)} reasoning tokens.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[8px] border border-border bg-surface-2 px-2.5 py-2">
      <div className="text-[11px] text-faint">{label}</div>
      <div className={`font-mono text-sm ${accent ? "text-success" : "text-text"}`}>
        {value}
      </div>
    </div>
  );
}
