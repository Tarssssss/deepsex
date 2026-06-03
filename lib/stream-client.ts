"use client";

/**
 * Client helper to POST /api/chat and consume the NDJSON StreamEvent stream.
 * Shared by the main agent loop and sub-agent runs so both parse the wire
 * format identically. Accumulates content/reasoning/tool-calls/usage and
 * optionally reports progress via `onEvent` for live UI rendering.
 */
import type { StreamEvent, ToolCall, TokenUsage } from "@/lib/types";

export interface StreamAggregate {
  content: string;
  reasoning: string;
  toolCalls: ToolCall[];
  usage: TokenUsage | null;
}

export async function streamChat(
  body: Record<string, unknown>,
  signal: AbortSignal,
  onEvent?: (evt: StreamEvent, agg: StreamAggregate) => void,
  url = "/api/chat"
): Promise<StreamAggregate> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const agg: StreamAggregate = {
    content: "",
    reasoning: "",
    toolCalls: [],
    usage: null,
  };

  const handle = (evt: StreamEvent) => {
    switch (evt.type) {
      case "reasoning":
        agg.reasoning += evt.delta;
        break;
      case "content":
        agg.content += evt.delta;
        break;
      case "tool_calls":
        agg.toolCalls = evt.calls;
        break;
      case "usage":
        agg.usage = evt.usage;
        break;
      case "error":
        throw new Error(evt.message);
      case "done":
        break;
    }
    onEvent?.(evt, agg);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      handle(JSON.parse(line) as StreamEvent);
    }
  }
  if (buffer.trim()) handle(JSON.parse(buffer.trim()) as StreamEvent);

  return agg;
}

export function safeParseArgs(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
