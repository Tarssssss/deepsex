/**
 * Thin client for the DeepSeek API (OpenAI-compatible chat completions).
 *
 * Streams an assistant turn as a sequence of {@link StreamEvent} objects so the
 * route handler can re-emit them as NDJSON. Handles the SSE wire format,
 * separate reasoning_content channel, and fragmented tool_calls accumulation.
 */
import type { ChatMessage, StreamEvent, ToolCall } from "@/lib/types";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

export interface StreamDeepSeekOptions {
  messages: ChatMessage[];
  /** Model id; falls back to DEEPSEEK_DEFAULT_MODEL then "deepseek-chat". */
  model?: string;
  /** OpenAI function-tool definitions (see TOOL_SCHEMAS). */
  tools?: unknown[];
  /** Optional abort signal to cancel the upstream request. */
  signal?: AbortSignal;
}

/** Mutable accumulator for one streamed tool call (arguments arrive in fragments). */
interface PartialToolCall {
  id: string;
  name: string;
  arguments: string;
}

function baseUrl(): string {
  const raw = process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;
  // Strip any trailing slash so we can append a known path cleanly.
  return raw.replace(/\/+$/, "");
}

/**
 * Stream a DeepSeek chat completion as StreamEvents.
 *
 * Yields {type:"reasoning"|"content", delta} as tokens arrive, then once tool
 * calls are fully assembled yields {type:"tool_calls", calls}, and finally
 * {type:"done", finishReason}. On any HTTP/parse error yields {type:"error"}.
 */
export async function* streamDeepSeek(
  opts: StreamDeepSeekOptions
): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    yield {
      type: "error",
      message:
        "DEEPSEEK_API_KEY is not set. Add it to your environment to call the DeepSeek API.",
    };
    return;
  }

  const model =
    opts.model || process.env.DEEPSEEK_DEFAULT_MODEL || DEFAULT_MODEL;

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    stream: true,
  };
  // Only advertise tools when we actually have some; otherwise tool_choice is moot.
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    yield {
      type: "error",
      message: `Failed to reach DeepSeek API: ${errMessage(err)}`,
    };
    return;
  }

  if (!res.ok || !res.body) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore body read failure */
    }
    yield {
      type: "error",
      message: `DeepSeek API error ${res.status} ${res.statusText}${
        detail ? `: ${detail.slice(0, 2000)}` : ""
      }`,
    };
    return;
  }

  // Accumulate tool calls by their stream index; arguments arrive in fragments.
  const toolCalls = new Map<number, PartialToolCall>();
  let finishReason: string | null = null;
  let emittedToolCalls = false;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines; process complete lines.
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const rawLine = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const line = rawLine.replace(/\r$/, "").trim();
        if (line === "" || !line.startsWith("data:")) continue;

        const data = line.slice("data:".length).trim();
        if (data === "[DONE]") {
          buffer = "";
          break;
        }

        let chunk: DeepSeekChunk;
        try {
          chunk = JSON.parse(data) as DeepSeekChunk;
        } catch {
          // Skip malformed/keep-alive fragments rather than aborting the stream.
          continue;
        }

        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (delta) {
          if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
            yield { type: "reasoning", delta: delta.reasoning_content };
          }
          if (typeof delta.content === "string" && delta.content) {
            yield { type: "content", delta: delta.content };
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const frag of delta.tool_calls) {
              const index = frag.index ?? 0;
              const existing =
                toolCalls.get(index) ?? { id: "", name: "", arguments: "" };
              if (frag.id) existing.id = frag.id;
              if (frag.function?.name) existing.name = frag.function.name;
              if (frag.function?.arguments) {
                existing.arguments += frag.function.arguments;
              }
              toolCalls.set(index, existing);
            }
          }
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }
    }
  } catch (err) {
    yield {
      type: "error",
      message: `Error reading DeepSeek stream: ${errMessage(err)}`,
    };
    return;
  } finally {
    reader.releaseLock?.();
  }

  // Emit fully-assembled tool calls (ordered by their stream index).
  if (toolCalls.size > 0) {
    const calls: ToolCall[] = [...toolCalls.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, c]) => ({
        id: c.id,
        type: "function" as const,
        function: { name: c.name, arguments: c.arguments },
      }));
    yield { type: "tool_calls", calls };
    emittedToolCalls = true;
  }

  // Normalize finish reason: if the model called tools, report "tool_calls".
  if (!finishReason && emittedToolCalls) {
    finishReason = "tool_calls";
  }
  yield { type: "done", finishReason };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/* ------------------------------------------------------------------ */
/* Minimal shapes for the DeepSeek SSE chunk payload                   */
/* ------------------------------------------------------------------ */

interface DeepSeekChunk {
  choices?: DeepSeekChoice[];
}

interface DeepSeekChoice {
  delta?: DeepSeekDelta;
  finish_reason?: string | null;
}

interface DeepSeekDelta {
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: DeepSeekToolCallFragment[];
}

interface DeepSeekToolCallFragment {
  index?: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}
