/**
 * POST /api/mcp
 *
 * Discovers the tools exposed by the client's configured MCP servers and
 * returns them (namespaced as mcp__<server>__<tool>) so the client can advertise
 * them to the model. The server holds no MCP state — config is sent each call.
 */
import type { McpServerConfig, McpToolInfo } from "@/lib/types";
import { listMcpTools } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface McpRequestBody {
  mcpServers?: McpServerConfig[];
}

export async function POST(request: Request): Promise<Response> {
  let body: McpRequestBody;
  try {
    body = (await request.json()) as McpRequestBody;
  } catch {
    return Response.json({ tools: [] as McpToolInfo[] });
  }
  const servers = Array.isArray(body?.mcpServers) ? body.mcpServers : [];
  try {
    const tools = await listMcpTools(servers);
    return Response.json({ tools });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ tools: [] as McpToolInfo[], error: message });
  }
}
