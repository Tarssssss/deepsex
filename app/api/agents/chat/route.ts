/**
 * POST /api/agents/chat
 *
 * Stateless streaming passthrough for a user-configured "custom agent". Takes an
 * OpenAI-compatible provider config (baseUrl, apiKey, model, systemPrompt,
 * temperature) + the conversation, calls `{baseUrl}/chat/completions` with
 * stream:true, and relays content deltas back as NDJSON StreamEvents (text only
 * — no tools). The API key is used only for this upstream call; nothing is
 * stored server-side.
 */
import type { StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AgentChatBody {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  messages: { role: "user" | "assistant"; content: string }[];
}

function chatUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "") + "/chat/completions";
}

export async function POST(request: Request): Promise<Response> {
  let body: AgentChatBody;
  try {
    body = (await request.json()) as AgentChatBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body?.baseUrl || !body?.model || !Array.isArray(body.messages)) {
    return Response.json(
      { error: "Body must include baseUrl, model, and messages." },
      { status: 400 }
    );
  }

  const messages = [
    ...(body.systemPrompt?.trim()
      ? [{ role: "system", content: body.systemPrompt.trim() }]
      : []),
    ...body.messages,
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      let upstream: Response;
      try {
        upstream = await fetch(chatUrl(body.baseUrl), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${body.apiKey}`,
          },
          body: JSON.stringify({
            model: body.model,
            messages,
            temperature: body.temperature ?? 0.7,
            stream: true,
          }),
          signal: request.signal,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit({ type: "error", message: `Couldn't reach the provider: ${msg}` });
        controller.close();
        return;
      }

      if (!upstream.ok || !upstream.body) {
        let detail = "";
        try {
          detail = await upstream.text();
        } catch {
          /* ignore */
        }
        emit({
          type: "error",
          message: `Provider error ${upstream.status} ${upstream.statusText}${
            detail ? `: ${detail.slice(0, 500)}` : ""
          }`,
        });
        controller.close();
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).replace(/\r$/, "").trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice("data:".length).trim();
            if (data === "[DONE]") continue;
            try {
              const chunk = JSON.parse(data) as {
                choices?: { delta?: { content?: string } }[];
              };
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) emit({ type: "content", delta });
            } catch {
              /* skip keep-alive / malformed frames */
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit({ type: "error", message: `Stream error: ${msg}` });
      } finally {
        emit({ type: "done", finishReason: "stop" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
