/**
 * POST /api/chat
 *
 * Streams one assistant turn from DeepSeek as NDJSON (one StreamEvent per line).
 * The client reads this line-by-line to render reasoning/content tokens, then
 * executes any tool calls and continues the agent loop with /api/tool.
 */
import type { ChatMessage, DeepSeekModel, StreamEvent } from "@/lib/types";
import { streamDeepSeek } from "@/lib/deepseek";
import { TOOL_SCHEMAS } from "@/lib/tools";
import { buildSystemPrompt } from "@/lib/prompt";
import { workspaceRoot } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  messages: ChatMessage[];
  model?: DeepSeekModel;
}

export async function POST(request: Request): Promise<Response> {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body || !Array.isArray(body.messages)) {
    return Response.json(
      { error: "Body must include a `messages` array." },
      { status: 400 }
    );
  }

  const system = buildSystemPrompt(workspaceRoot());
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...body.messages,
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        for await (const event of streamDeepSeek({
          messages,
          model: body.model,
          tools: TOOL_SCHEMAS,
          signal: request.signal,
        })) {
          emit(event);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit({ type: "error", message });
      } finally {
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
