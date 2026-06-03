"use client";

/**
 * useAgent — the client-side Codex agent loop.
 *
 * Owns the conversation and drives the read→think→act loop:
 *   1. POST the running conversation to /api/chat, stream one assistant turn.
 *   2. If the turn proposes tool calls, gate each on the approval policy,
 *      execute approved ones via /api/tool, append results, and loop.
 *   3. Stop when the model returns a turn with no tool calls.
 *
 * The server is stateless: /api/chat returns a single assistant turn (never
 * executes tools), /api/tool executes one tool. All orchestration lives here.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ChatMessage,
  ToolCall,
  ToolInvocation,
  ToolResult,
  StreamEvent,
  UIMessage,
  DeepSeekModel,
  ApprovalMode,
  COMMAND_TOOLS,
} from "@/lib/types";

export type AgentStatus =
  | "idle"
  | "thinking"
  | "streaming"
  | "awaiting-approval"
  | "running-tool";

let idCounter = 0;
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

function toolNeedsApproval(mode: ApprovalMode, name: string): boolean {
  if (mode === "full-auto") return false;
  if (mode === "suggest") return true;
  // auto-edit: all file operations (read/write/edit/list) run automatically;
  // only shell commands require explicit approval.
  return COMMAND_TOOLS.includes(name as never);
}

interface ApprovalResolver {
  resolve: (approved: boolean) => void;
}

export function useAgent() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<DeepSeekModel>("deepseek-chat");
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>("auto-edit");
  const [awaitingApprovalIds, setAwaitingApprovalIds] = useState<Set<string>>(
    () => new Set()
  );
  const [workspaceVersion, setWorkspaceVersion] = useState(0);

  // Wire-format conversation (user/assistant/tool only — server adds system).
  const wireRef = useRef<ChatMessage[]>([]);
  // Pending approval resolvers, keyed by tool_call id.
  const approvalsRef = useRef<Map<string, ApprovalResolver>>(new Map());
  // Abort handling.
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  const busy = status !== "idle";

  /* -------------------- message helpers -------------------- */

  const patchMessage = useCallback(
    (id: string, patch: Partial<UIMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    },
    []
  );

  const patchTool = useCallback(
    (msgId: string, toolId: string, patch: Partial<ToolInvocation>) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          return {
            ...m,
            tools: (m.tools || []).map((t) =>
              t.id === toolId ? { ...t, ...patch } : t
            ),
          };
        })
      );
    },
    []
  );

  /* -------------------- streaming one turn -------------------- */

  async function streamTurn(assistantId: string): Promise<{
    content: string;
    reasoning: string;
    toolCalls: ToolCall[];
  }> {
    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: wireRef.current, model }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    let content = "";
    let reasoning = "";
    let toolCalls: ToolCall[] = [];
    let gotFirst = false;

    const handle = (evt: StreamEvent) => {
      switch (evt.type) {
        case "reasoning":
          reasoning += evt.delta;
          if (!gotFirst) {
            gotFirst = true;
            setStatus("streaming");
          }
          patchMessage(assistantId, { reasoning });
          break;
        case "content":
          content += evt.delta;
          if (!gotFirst) {
            gotFirst = true;
            setStatus("streaming");
          }
          patchMessage(assistantId, { content });
          break;
        case "tool_calls":
          toolCalls = evt.calls;
          patchMessage(assistantId, {
            tools: evt.calls.map<ToolInvocation>((c) => ({
              id: c.id,
              name: c.function.name,
              args: safeParseArgs(c.function.arguments),
              status: "pending",
            })),
          });
          break;
        case "error":
          throw new Error(evt.message);
        case "done":
          break;
      }
    };

    // Read the NDJSON stream.
    // eslint-disable-next-line no-constant-condition
    while (true) {
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
    if (buffer.trim()) {
      handle(JSON.parse(buffer.trim()) as StreamEvent);
    }

    return { content, reasoning, toolCalls };
  }

  /* -------------------- approval gate -------------------- */

  function waitForApproval(toolId: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      approvalsRef.current.set(toolId, { resolve });
      setAwaitingApprovalIds((prev) => {
        const next = new Set(prev);
        next.add(toolId);
        return next;
      });
    });
  }

  function settleApproval(toolId: string, approved: boolean) {
    const entry = approvalsRef.current.get(toolId);
    if (!entry) return;
    approvalsRef.current.delete(toolId);
    setAwaitingApprovalIds((prev) => {
      const next = new Set(prev);
      next.delete(toolId);
      return next;
    });
    entry.resolve(approved);
  }

  const approve = useCallback((toolId: string) => {
    settleApproval(toolId, true);
  }, []);

  const reject = useCallback((toolId: string) => {
    settleApproval(toolId, false);
  }, []);

  const approveAll = useCallback(() => {
    const ids = Array.from(approvalsRef.current.keys());
    ids.forEach((id) => settleApproval(id, true));
  }, []);

  /* -------------------- tool execution -------------------- */

  async function execTool(
    assistantId: string,
    call: ToolCall
  ): Promise<ChatMessage> {
    const name = call.function.name;
    const args = safeParseArgs(call.function.arguments);

    patchTool(assistantId, call.id, { status: "running" });
    setStatus("running-tool");

    try {
      const res = await fetch("/api/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, args }),
      });
      const result = (await res.json()) as ToolResult;

      patchTool(assistantId, call.id, {
        status: result.ok ? "success" : "error",
        result: result.output,
        error: result.ok ? undefined : result.output,
        meta: result.meta,
      });

      if (result.meta?.mutated) {
        setWorkspaceVersion((v) => v + 1);
      }

      return {
        role: "tool",
        tool_call_id: call.id,
        name,
        content: result.output,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      patchTool(assistantId, call.id, { status: "error", error: msg });
      return {
        role: "tool",
        tool_call_id: call.id,
        name,
        content: `Error: ${msg}`,
      };
    }
  }

  /* -------------------- the loop -------------------- */

  async function runLoop() {
    if (runningRef.current) return;
    runningRef.current = true;
    setError(null);

    const MAX_TURNS = 24;
    try {
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        setStatus("thinking");
        const assistantId = uid("a");
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            tools: [],
            streaming: true,
            createdAt: Date.now(),
          },
        ]);

        const { content, reasoning, toolCalls } = await streamTurn(assistantId);

        // Commit the assistant turn to the wire conversation.
        const assistantWire: ChatMessage = {
          role: "assistant",
          content: content || (toolCalls.length ? "" : ""),
        };
        if (reasoning) assistantWire.reasoning_content = reasoning;
        if (toolCalls.length) assistantWire.tool_calls = toolCalls;
        wireRef.current = [...wireRef.current, assistantWire];

        if (!toolCalls.length) {
          patchMessage(assistantId, { streaming: false });
          break;
        }

        // Resolve each proposed tool call in order.
        for (const call of toolCalls) {
          const name = call.function.name;
          if (toolNeedsApproval(approvalMode, name)) {
            setStatus("awaiting-approval");
            const approved = await waitForApproval(call.id);
            if (!approved) {
              patchTool(assistantId, call.id, { status: "rejected" });
              wireRef.current = [
                ...wireRef.current,
                {
                  role: "tool",
                  tool_call_id: call.id,
                  name,
                  content:
                    "The user rejected this tool call. Do not retry it; consider an alternative or ask the user.",
                },
              ];
              continue;
            }
          }
          const toolMsg = await execTool(assistantId, call);
          wireRef.current = [...wireRef.current, toolMsg];
        }

        patchMessage(assistantId, { streaming: false });
        // loop continues for the model's next turn
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // user stopped — leave state as-is
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
      );
      runningRef.current = false;
      abortRef.current = null;
      setStatus("idle");
    }
  }

  /* -------------------- public actions -------------------- */

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || runningRef.current) return;
      wireRef.current = [
        ...wireRef.current,
        { role: "user", content: trimmed },
      ];
      setMessages((prev) => [
        ...prev,
        {
          id: uid("u"),
          role: "user",
          content: trimmed,
          createdAt: Date.now(),
        },
      ]);
      void runLoop();
    },
    // runLoop closes over model/approvalMode via refs/state; recreate on change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, approvalMode]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    // Resolve any outstanding approvals as rejected so the loop can unwind.
    Array.from(approvalsRef.current.keys()).forEach((id) =>
      settleApproval(id, false)
    );
    runningRef.current = false;
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    if (runningRef.current) abortRef.current?.abort();
    approvalsRef.current.clear();
    wireRef.current = [];
    runningRef.current = false;
    setMessages([]);
    setAwaitingApprovalIds(new Set());
    setError(null);
    setStatus("idle");
  }, []);

  return useMemo(
    () => ({
      messages,
      status,
      busy,
      error,
      model,
      setModel,
      approvalMode,
      setApprovalMode,
      awaitingApprovalIds,
      workspaceVersion,
      send,
      approve,
      reject,
      approveAll,
      stop,
      reset,
    }),
    [
      messages,
      status,
      busy,
      error,
      model,
      approvalMode,
      awaitingApprovalIds,
      workspaceVersion,
      send,
      approve,
      reject,
      approveAll,
      stop,
      reset,
    ]
  );
}

function safeParseArgs(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
