/**
 * POST /api/chat
 *
 * Streams one assistant turn from DeepSeek as NDJSON (one StreamEvent per line).
 * The client reads this line-by-line to render reasoning/content tokens, then
 * executes any tool calls and continues the agent loop with /api/tool.
 *
 * The server is stateless: durable config (effort, memory, skills, MCP tools)
 * is sent by the client each turn and folded into a deterministic system prompt
 * + tool list so DeepSeek's prefix cache stays warm across the loop.
 */
import type {
  ChatMessage,
  DeepSeekModel,
  McpToolInfo,
  ReasoningEffort,
  StreamEvent,
} from "@/lib/types";
import { MODELS } from "@/lib/types";
import { streamDeepSeek } from "@/lib/deepseek";
import { TOOL_SCHEMAS, CLIENT_TOOL_SCHEMAS, type ToolSchema } from "@/lib/tools";
import { buildSystemPrompt, type SkillRef, type AgentRef } from "@/lib/prompt";
import { workspaceRoot } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  messages: ChatMessage[];
  model?: DeepSeekModel;
  reasoningEffort?: ReasoningEffort;
  memory?: string;
  systemPromptOverride?: string;
  skills?: SkillRef[];
  agents?: AgentRef[];
  goalMode?: boolean;
  /** Extra tool schemas discovered from configured MCP servers. */
  mcpTools?: McpToolInfo[];
  /**
   * When true, advertise ONLY the core file/command tools (no planning,
   * ask_user, sub-agents, etc.). Used for sub-agent runs — sub-agents must not
   * spawn further sub-agents.
   */
  coreToolsOnly?: boolean;
}

function mcpToToolSchema(tools: McpToolInfo[] = []): ToolSchema[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters ?? { type: "object", properties: {} },
    },
  }));
}

export async function POST(request: Request): Promise<Response> {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || !Array.isArray(body.messages)) {
    return Response.json(
      { error: "Body must include a `messages` array." },
      { status: 400 }
    );
  }

  const modelInfo = MODELS.find((m) => m.id === body.model);

  const system = buildSystemPrompt({
    cwd: workspaceRoot(),
    reasoningEffort: body.reasoningEffort,
    memory: body.memory,
    skills: body.skills,
    agents: body.agents,
    goalMode: body.goalMode,
    override: body.systemPromptOverride,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...body.messages,
  ];

  // Stable tool prefix: core tools, then client-orchestrated tools, then MCP.
  const tools: ToolSchema[] = body.coreToolsOnly
    ? [...TOOL_SCHEMAS]
    : [
        ...TOOL_SCHEMAS,
        ...CLIENT_TOOL_SCHEMAS,
        ...mcpToToolSchema(body.mcpTools),
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
          tools,
          reasoningEffort: body.reasoningEffort,
          reasoning: modelInfo?.reasoning,
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
