/**
 * POST /api/tool
 *
 * Executes a single tool call against the sandboxed workspace and returns a
 * ToolResult. The client calls this for each tool the model requested (after
 * approval, depending on the approval mode) and feeds the output back into the
 * conversation.
 */
import type { McpServerConfig, ToolResult } from "@/lib/types";
import { executeTool } from "@/lib/tools";

export const runtime = "nodejs";

interface ToolRequestBody {
  name: string;
  args: Record<string, unknown>;
  /** MCP server config (for routing mcp__ tool calls). */
  mcpServers?: McpServerConfig[];
  /** Active workspace root (the folder the user opened). */
  root?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ToolRequestBody;

    if (!body || typeof body.name !== "string") {
      const result: ToolResult = {
        ok: false,
        output: "Error: request body must include a string `name`.",
      };
      return Response.json(result);
    }

    const args =
      body.args && typeof body.args === "object" ? body.args : {};
    const result = await executeTool(body.name, args, {
      mcpServers: body.mcpServers,
      root: body.root,
    });
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const result: ToolResult = { ok: false, output: "Error: " + msg };
    return Response.json(result, { status: 200 });
  }
}
