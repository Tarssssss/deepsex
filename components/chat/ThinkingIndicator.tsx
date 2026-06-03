"use client";

import { DeepSeekLogo } from "@/components/brand/DeepSeekLogo";

/**
 * Small inline indicator shown while waiting for the first token of an
 * assistant turn: a gently pulsing DeepSeek mark + three animated dots.
 */
export function ThinkingIndicator({ label }: { label?: string }) {
  return (
    <div className="ds-fade-up flex items-center gap-2.5 text-sm text-muted">
      <span className="ds-shimmer inline-flex h-6 w-6 items-center justify-center">
        <DeepSeekLogo size={20} />
      </span>
      <span>{label ?? "DeepSex is thinking"}</span>
      <span className="inline-flex items-center gap-1" aria-hidden>
        <Dot delay="0ms" />
        <Dot delay="160ms" />
        <Dot delay="320ms" />
      </span>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="ds-shimmer inline-block h-1.5 w-1.5 rounded-full bg-faint"
      style={{ animationDelay: delay }}
    />
  );
}
