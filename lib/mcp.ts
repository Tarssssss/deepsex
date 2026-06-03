/**
 * Minimal Model Context Protocol (MCP) client over Streamable HTTP.
 *
 * Implemented directly (no SDK dependency) to keep the install footprint small.
 * Supports the modern Streamable-HTTP transport: JSON-RPC 2.0 over HTTP POST,
 * where the server may respond with either `application/json` (one object) or
 * `text/event-stream` (SSE). We do the initialize handshake, then `tools/list`
 * / `tools/call`, threading the `Mcp-Session-Id` header through.
 *
 * Tools are surfaced to the model namespaced as `mcp__<server>__<tool>` so they
 * never collide with the built-in tools (Codex/Claude convention).
 */
import type { McpServerConfig, McpToolInfo, ToolResult } from "@/lib/types";
import { MCP_TOOL_PREFIX } from "@/lib/types";

const PROTOCOL_VERSION = "2025-06-18";
const REQUEST_TIMEOUT_MS = 20_000;

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

/** Sanitize a server name into the `mcp__<server>__<tool>` namespace segment. */
function serverSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function mcpToolName(server: string, tool: string): string {
  return `${MCP_TOOL_PREFIX}${serverSlug(server)}__${tool}`;
}

/** Parse a Streamable-HTTP response that may be JSON or SSE. */
async function readRpcResponse(res: Response): Promise<JsonRpcResponse | null> {
  const ctype = res.headers.get("content-type") || "";
  const text = await res.text();
  if (ctype.includes("text/event-stream")) {
    // Collect `data:` lines; return the last JSON-RPC object with a result/error.
    let last: JsonRpcResponse | null = null;
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice("data:".length).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload) as JsonRpcResponse;
        if (obj && (obj.result !== undefined || obj.error)) last = obj;
      } catch {
        /* skip non-JSON SSE frames */
      }
    }
    return last;
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as JsonRpcResponse;
  } catch {
    return null;
  }
}

interface McpSession {
  sessionId?: string;
}

async function rpc(
  server: McpServerConfig,
  method: string,
  params: unknown,
  session: McpSession,
  id: number
): Promise<JsonRpcResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
      ...(server.headers || {}),
    };
    if (session.sessionId) headers["Mcp-Session-Id"] = session.sessionId;

    const res = await fetch(server.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: controller.signal,
    });
    const sid = res.headers.get("Mcp-Session-Id");
    if (sid) session.sessionId = sid;
    if (!res.ok) {
      return { jsonrpc: "2.0", error: { code: res.status, message: `HTTP ${res.status}` } };
    }
    return await readRpcResponse(res);
  } finally {
    clearTimeout(timer);
  }
}

async function notify(
  server: McpServerConfig,
  method: string,
  session: McpSession
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
    ...(server.headers || {}),
  };
  if (session.sessionId) headers["Mcp-Session-Id"] = session.sessionId;
  try {
    await fetch(server.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", method }),
    });
  } catch {
    /* best-effort notification */
  }
}

async function initialize(server: McpServerConfig): Promise<McpSession> {
  const session: McpSession = {};
  await rpc(
    server,
    "initialize",
    {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "deepseek-codex", version: "1.0" },
    },
    session,
    1
  );
  await notify(server, "notifications/initialized", session);
  return session;
}

interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/** List tools across all enabled servers, namespaced. Failures are skipped. */
export async function listMcpTools(
  servers: McpServerConfig[]
): Promise<McpToolInfo[]> {
  const enabled = servers.filter((s) => s.enabled && s.url);
  const results = await Promise.all(
    enabled.map(async (server) => {
      try {
        const session = await initialize(server);
        const resp = await rpc(server, "tools/list", {}, session, 2);
        const tools =
          ((resp?.result as { tools?: McpToolDef[] })?.tools) ?? [];
        return tools.map<McpToolInfo>((t) => ({
          name: mcpToolName(server.name, t.name),
          server: server.name,
          description: t.description || `${t.name} (via ${server.name})`,
          parameters: t.inputSchema ?? { type: "object", properties: {} },
        }));
      } catch {
        return [];
      }
    })
  );
  return results.flat();
}

/** Call a namespaced MCP tool. Resolves the server from the namespace. */
export async function callMcpTool(
  servers: McpServerConfig[],
  namespacedName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const server = servers.find(
    (s) =>
      s.enabled &&
      namespacedName.startsWith(`${MCP_TOOL_PREFIX}${serverSlug(s.name)}__`)
  );
  if (!server) {
    return { ok: false, output: `Error: no MCP server found for "${namespacedName}".` };
  }
  const toolName = namespacedName.slice(
    `${MCP_TOOL_PREFIX}${serverSlug(server.name)}__`.length
  );
  try {
    const session = await initialize(server);
    const resp = await rpc(
      server,
      "tools/call",
      { name: toolName, arguments: args },
      session,
      3
    );
    if (resp?.error) {
      return { ok: false, output: `MCP error: ${resp.error.message}`, meta: { mcpServer: server.name } };
    }
    const result = resp?.result as
      | { content?: Array<{ type: string; text?: string }>; isError?: boolean }
      | undefined;
    const text =
      (result?.content || [])
        .map((c) => (c.type === "text" ? c.text ?? "" : `[${c.type}]`))
        .join("\n")
        .trim() || "(no content)";
    return {
      ok: !result?.isError,
      output: text,
      meta: { mcpServer: server.name },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, output: `Error calling MCP tool: ${msg}`, meta: { mcpServer: server.name } };
  }
}
