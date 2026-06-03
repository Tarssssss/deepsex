"use client";

/**
 * useAgent — the client-side Codex agent loop.
 *
 * The server is stateless: /api/chat streams one assistant turn (never executes
 * tools), /api/tool executes one server tool. All orchestration lives here:
 *
 *   1. POST the running conversation + config to /api/chat, stream one turn.
 *   2. For each proposed tool call, route it:
 *        - server tools (file/command/MCP) → /api/tool, gated by approval policy
 *        - client tools (plan/ask_user/sub-agent/skill/remember/complete) → here
 *   3. Append results and loop until the model stops calling tools.
 *
 * On top of the loop it owns: persistent settings + memory, Codex-style session
 * rollouts, token/cache usage accounting, a live plan, interactive questions,
 * parallel sub-agents, MCP tool discovery, and goal (Ralph) mode.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChatMessage,
  ToolCall,
  ToolInvocation,
  ToolResult,
  UIMessage,
  DeepSeekModel,
  ApprovalMode,
  ReasoningEffort,
  AgentSettings,
  DEFAULT_SETTINGS,
  PlanStep,
  PlanStepStatus,
  UserQuestion,
  SubAgentRun,
  McpToolInfo,
  SessionMeta,
  TokenUsage,
  UsageTotals,
  emptyUsageTotals,
  estimateCost,
  COMMAND_TOOLS,
  CLIENT_TOOLS,
} from "@/lib/types";
import { streamChat, safeParseArgs } from "@/lib/stream-client";
import {
  loadSettings,
  saveSettings,
  loadSessionIndex,
  loadSession,
  saveSession,
  deleteSession,
  deriveTitle,
} from "@/lib/storage";
import { activeSkills, BUILTIN_AGENTS } from "@/lib/skills";

export type AgentStatus =
  | "idle"
  | "thinking"
  | "streaming"
  | "awaiting-approval"
  | "awaiting-input"
  | "running-tool"
  | "subagent";

let idCounter = 0;
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

function isClientTool(name: string): boolean {
  return (CLIENT_TOOLS as string[]).includes(name);
}

function toolNeedsApproval(
  settings: AgentSettings,
  name: string
): boolean {
  // Client-orchestrated tools touch no filesystem/shell — always auto.
  if (isClientTool(name)) return false;
  // Goal (Ralph) mode runs unattended in the sandbox — never gate.
  if (settings.goalMode) return false;
  if (settings.approvalMode === "full-auto") return false;
  if (settings.approvalMode === "suggest") return true;
  // auto-edit: file ops auto; shell commands + MCP tools need approval.
  return COMMAND_TOOLS.includes(name as never) || name.startsWith("mcp__");
}

interface Resolver<T> {
  resolve: (value: T) => void;
}

function applyTheme(pref: AgentSettings["theme"]) {
  if (typeof document === "undefined") return;
  const resolved =
    pref === "system"
      ? window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : pref;
  document.documentElement.dataset.theme = resolved;
}

function normalizePlan(raw: unknown): PlanStep[] {
  if (!Array.isArray(raw)) return [];
  const valid: PlanStepStatus[] = ["pending", "in_progress", "completed"];
  return raw
    .map((s) => {
      const obj = (s ?? {}) as Record<string, unknown>;
      const step = typeof obj.step === "string" ? obj.step : "";
      const status = valid.includes(obj.status as PlanStepStatus)
        ? (obj.status as PlanStepStatus)
        : "pending";
      return { step, status };
    })
    .filter((s) => s.step);
}

function normalizeQuestions(raw: unknown): UserQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q) => {
      const obj = (q ?? {}) as Record<string, unknown>;
      const options = Array.isArray(obj.options)
        ? obj.options.map((o) => {
            const oo = (o ?? {}) as Record<string, unknown>;
            return {
              label: String(oo.label ?? ""),
              description:
                typeof oo.description === "string" ? oo.description : undefined,
            };
          })
        : [];
      return {
        question: String(obj.question ?? ""),
        header: String(obj.header ?? "Choose").slice(0, 16),
        multiSelect: !!obj.multiSelect,
        options: options.filter((o) => o.label),
      };
    })
    .filter((q) => q.question && q.options.length);
}

export function useAgent() {
  const [settings, setSettingsState] = useState<AgentSettings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [awaitingApprovalIds, setAwaitingApprovalIds] = useState<Set<string>>(
    () => new Set()
  );
  const [pendingQuestionIds, setPendingQuestionIds] = useState<Set<string>>(
    () => new Set()
  );
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [usage, setUsage] = useState<UsageTotals>(emptyUsageTotals());
  const [mcpTools, setMcpTools] = useState<McpToolInfo[]>([]);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [goalIteration, setGoalIteration] = useState(0);
  const [workspaceVersion, setWorkspaceVersion] = useState(0);

  // Refs for use inside the async loop (avoid stale closures).
  const wireRef = useRef<ChatMessage[]>([]);
  const settingsRef = useRef(settings);
  const planRef = useRef<PlanStep[]>([]);
  const mcpToolsRef = useRef<McpToolInfo[]>([]);
  const usageRef = useRef<UsageTotals>(emptyUsageTotals());
  const goalRef = useRef<string>("");
  const goalIterationRef = useRef(0);
  const sessionRef = useRef<{ id: string; createdAt: number } | null>(null);
  const approvalsRef = useRef<Map<string, Resolver<boolean>>>(new Map());
  const questionsRef = useRef<Map<string, Resolver<Record<string, string>>>>(
    new Map()
  );
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  // Mirror reactive state into refs so the async agent loop reads fresh values
  // without stale closures. Synced after commit (not during render).
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);
  useEffect(() => {
    mcpToolsRef.current = mcpTools;
  }, [mcpTools]);
  useEffect(() => {
    usageRef.current = usage;
  }, [usage]);

  const busy = status !== "idle";

  /* -------------------- hydrate on mount -------------------- */

  useEffect(() => {
    // Hydrate persisted settings/sessions from localStorage (external system).
    const s = loadSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettingsState(s);
    applyTheme(s.theme);
    setSessions(loadSessionIndex());
    // React to OS theme changes when in "system" mode.
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (settingsRef.current.theme === "system") applyTheme("system");
    };
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  /* -------------------- settings -------------------- */

  const updateSettings = useCallback((patch: Partial<AgentSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      if (patch.theme) applyTheme(next.theme);
      return next;
    });
  }, []);

  /* -------------------- MCP tool discovery -------------------- */

  useEffect(() => {
    const enabled = settings.mcpServers.filter((s) => s.enabled && s.url);
    if (enabled.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMcpTools([]);
      return;
    }
    let cancelled = false;
    fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mcpServers: enabled }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMcpTools(Array.isArray(d.tools) ? d.tools : []);
      })
      .catch(() => {
        if (!cancelled) setMcpTools([]);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.mcpServers]);

  /* -------------------- message helpers -------------------- */

  const patchMessage = useCallback((id: string, patch: Partial<UIMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

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

  const addUsage = useCallback((u: TokenUsage, model: DeepSeekModel) => {
    setUsage((prev) => {
      const next: UsageTotals = {
        prompt_tokens: prev.prompt_tokens + u.prompt_tokens,
        completion_tokens: prev.completion_tokens + u.completion_tokens,
        total_tokens: prev.total_tokens + u.total_tokens,
        prompt_cache_hit_tokens:
          (prev.prompt_cache_hit_tokens ?? 0) + (u.prompt_cache_hit_tokens ?? 0),
        prompt_cache_miss_tokens:
          (prev.prompt_cache_miss_tokens ?? 0) +
          (u.prompt_cache_miss_tokens ?? 0),
        reasoning_tokens:
          (prev.reasoning_tokens ?? 0) + (u.reasoning_tokens ?? 0),
        turns: prev.turns + 1,
        costUsd: prev.costUsd + estimateCost(u, model),
      };
      usageRef.current = next;
      return next;
    });
  }, []);

  /* -------------------- config for /api/chat -------------------- */

  function chatConfig(): Record<string, unknown> {
    const s = settingsRef.current;
    const skills = activeSkills(s.customSkills, s.disabledSkills).map((sk) => ({
      name: sk.name,
      description: sk.description,
    }));
    return {
      model: s.model,
      reasoningEffort: s.reasoningEffort,
      memory: s.memory,
      systemPromptOverride: s.systemPromptOverride,
      skills,
      agents: BUILTIN_AGENTS.map((a) => ({
        name: a.name,
        description: a.description,
      })),
      goalMode: s.goalMode,
      mcpTools: mcpToolsRef.current,
      workspaceRoot: s.workspaceRoot,
    };
  }

  /* -------------------- approval gate -------------------- */

  function waitForApproval(toolId: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      approvalsRef.current.set(toolId, { resolve });
      setAwaitingApprovalIds((prev) => new Set(prev).add(toolId));
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

  const approve = useCallback((toolId: string) => settleApproval(toolId, true), []);
  const reject = useCallback((toolId: string) => settleApproval(toolId, false), []);
  const approveAll = useCallback(() => {
    Array.from(approvalsRef.current.keys()).forEach((id) =>
      settleApproval(id, true)
    );
  }, []);

  /* -------------------- question gate (ask_user) -------------------- */

  function waitForAnswer(toolId: string): Promise<Record<string, string>> {
    return new Promise((resolve) => {
      questionsRef.current.set(toolId, { resolve });
      setPendingQuestionIds((prev) => new Set(prev).add(toolId));
    });
  }

  const answerQuestion = useCallback(
    (toolId: string, answers: Record<string, string>) => {
      const entry = questionsRef.current.get(toolId);
      if (!entry) return;
      questionsRef.current.delete(toolId);
      setPendingQuestionIds((prev) => {
        const next = new Set(prev);
        next.delete(toolId);
        return next;
      });
      entry.resolve(answers);
    },
    []
  );

  /* -------------------- server tool execution -------------------- */

  async function execServerTool(
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
        body: JSON.stringify({
          name,
          args,
          mcpServers: settingsRef.current.mcpServers,
          root: settingsRef.current.workspaceRoot,
        }),
      });
      const result = (await res.json()) as ToolResult;
      patchTool(assistantId, call.id, {
        status: result.ok ? "success" : "error",
        result: result.output,
        error: result.ok ? undefined : result.output,
        meta: result.meta,
      });
      if (result.meta?.mutated) setWorkspaceVersion((v) => v + 1);
      return { role: "tool", tool_call_id: call.id, name, content: result.output };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      patchTool(assistantId, call.id, { status: "error", error: msg });
      return { role: "tool", tool_call_id: call.id, name, content: `Error: ${msg}` };
    }
  }

  /* -------------------- sub-agent runner -------------------- */

  async function runSubAgent(
    assistantId: string,
    call: ToolCall
  ): Promise<ChatMessage> {
    const args = safeParseArgs(call.function.arguments);
    const agentName = String(args.agent ?? "general");
    const task = String(args.task ?? "");
    const profile =
      BUILTIN_AGENTS.find((a) => a.name === agentName) ?? BUILTIN_AGENTS[0];

    const run: SubAgentRun = {
      agent: profile.name,
      task,
      result: "",
      turns: 0,
      status: "running",
      tools: [],
    };
    patchTool(assistantId, call.id, { status: "running", meta: { subagent: run } });
    setStatus("subagent");

    const controller = abortRef.current ?? new AbortController();
    const subWire: ChatMessage[] = [{ role: "user", content: task }];
    const MAX = 14;
    let finalText = "";

    try {
      for (let t = 0; t < MAX; t++) {
        const agg = await streamChat(
          {
            messages: subWire,
            model: settingsRef.current.model,
            reasoningEffort: settingsRef.current.reasoningEffort,
            systemPromptOverride: profile.prompt,
            coreToolsOnly: true,
            workspaceRoot: settingsRef.current.workspaceRoot,
          },
          controller.signal
        );
        run.turns = t + 1;
        if (agg.usage) addUsage(agg.usage, settingsRef.current.model);
        if (agg.content) finalText = agg.content;

        const aw: ChatMessage = { role: "assistant", content: agg.content || "" };
        if (agg.reasoning) aw.reasoning_content = agg.reasoning;
        if (agg.toolCalls.length) aw.tool_calls = agg.toolCalls;
        subWire.push(aw);

        if (!agg.toolCalls.length) break;

        for (const c of agg.toolCalls) {
          const cname = c.function.name;
          const cargs = safeParseArgs(c.function.arguments);
          const res = (await (
            await fetch("/api/tool", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: cname,
                args: cargs,
                mcpServers: settingsRef.current.mcpServers,
                root: settingsRef.current.workspaceRoot,
              }),
            })
          ).json()) as ToolResult;
          run.tools = [
            ...(run.tools ?? []),
            {
              id: c.id,
              name: cname,
              args: cargs,
              status: res.ok ? "success" : "error",
              result: res.output,
              meta: res.meta,
            },
          ];
          patchTool(assistantId, call.id, { meta: { subagent: { ...run } } });
          if (res.meta?.mutated) setWorkspaceVersion((v) => v + 1);
          subWire.push({
            role: "tool",
            tool_call_id: c.id,
            name: cname,
            content: res.output,
          });
        }
      }
      run.result = finalText || "(sub-agent finished with no summary)";
      run.status = "success";
      patchTool(assistantId, call.id, {
        status: "success",
        result: run.result,
        meta: { subagent: { ...run } },
      });
      return {
        role: "tool",
        tool_call_id: call.id,
        name: "spawn_subagent",
        content: `Sub-agent (${profile.name}) result:\n${run.result}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      run.status = "error";
      run.result = msg;
      patchTool(assistantId, call.id, {
        status: "error",
        error: msg,
        meta: { subagent: { ...run } },
      });
      return {
        role: "tool",
        tool_call_id: call.id,
        name: "spawn_subagent",
        content: `Sub-agent error: ${msg}`,
      };
    }
  }

  /* -------------------- client tool execution -------------------- */

  async function execClientTool(
    assistantId: string,
    call: ToolCall
  ): Promise<{ msg: ChatMessage; complete?: boolean }> {
    const name = call.function.name;
    const args = safeParseArgs(call.function.arguments);
    const reply = (content: string): ChatMessage => ({
      role: "tool",
      tool_call_id: call.id,
      name,
      content,
    });

    switch (name) {
      case "update_plan": {
        const steps = normalizePlan(args.steps);
        setPlan(steps);
        planRef.current = steps;
        patchTool(assistantId, call.id, {
          status: "success",
          result: "Plan updated.",
          meta: { plan: steps },
        });
        return { msg: reply("Plan updated.") };
      }
      case "use_skill": {
        const wanted = String(args.name ?? "");
        const s = settingsRef.current;
        const skill = activeSkills(s.customSkills, s.disabledSkills).find(
          (sk) => sk.name === wanted
        );
        const body = skill
          ? skill.body
          : `No skill named "${wanted}" is available.`;
        patchTool(assistantId, call.id, {
          status: skill ? "success" : "error",
          result: body,
          meta: { skill: wanted },
        });
        return {
          msg: reply(
            skill ? `Skill "${skill.name}" instructions:\n\n${body}` : body
          ),
        };
      }
      case "remember": {
        const note = String(args.note ?? "").trim();
        if (note) {
          const prevMem = settingsRef.current.memory;
          const nextMem = prevMem ? `${prevMem}\n- ${note}` : `- ${note}`;
          updateSettings({ memory: nextMem });
        }
        patchTool(assistantId, call.id, {
          status: "success",
          result: note ? `Remembered: ${note}` : "Nothing to remember.",
        });
        return { msg: reply("Saved to long-term memory.") };
      }
      case "ask_user": {
        const questions = normalizeQuestions(args.questions);
        if (questions.length === 0) {
          patchTool(assistantId, call.id, {
            status: "error",
            error: "No valid questions.",
          });
          return { msg: reply("No valid questions were provided.") };
        }
        patchTool(assistantId, call.id, {
          status: "pending",
          meta: { questions },
        });
        setStatus("awaiting-input");
        const answers = await waitForAnswer(call.id);
        const answered = Object.keys(answers).length > 0;
        patchTool(assistantId, call.id, {
          status: answered ? "success" : "rejected",
          meta: { questions, answers },
          result: JSON.stringify(answers),
        });
        const formatted = answered
          ? questions
              .map((q) => `${q.question}\n→ ${answers[q.question] ?? "(no answer)"}`)
              .join("\n\n")
          : "The user dismissed the questions without answering.";
        return { msg: reply(formatted) };
      }
      case "task_complete": {
        const summary = String(args.summary ?? "").trim();
        patchTool(assistantId, call.id, {
          status: "success",
          result: summary || "Task complete.",
        });
        return { msg: reply("Acknowledged — task marked complete."), complete: true };
      }
      default:
        return { msg: reply(`Error: unknown client tool "${name}".`) };
    }
  }

  /* -------------------- the loop -------------------- */

  async function runLoop() {
    if (runningRef.current) return;
    runningRef.current = true;
    setError(null);

    const goalMode = settingsRef.current.goalMode;
    const maxIter = settingsRef.current.goalMaxIterations;
    const MAX_TURNS = goalMode ? Math.max(24, maxIter * 8) : 24;
    let completed = false;

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

        const controller = new AbortController();
        abortRef.current = controller;
        let started = false;

        const agg = await streamChat(
          { messages: wireRef.current, ...chatConfig() },
          controller.signal,
          (evt, a) => {
            if ((evt.type === "content" || evt.type === "reasoning") && !started) {
              started = true;
              setStatus("streaming");
            }
            if (evt.type === "content") patchMessage(assistantId, { content: a.content });
            if (evt.type === "reasoning")
              patchMessage(assistantId, { reasoning: a.reasoning });
            if (evt.type === "tool_calls") {
              patchMessage(assistantId, {
                tools: a.toolCalls.map<ToolInvocation>((c) => ({
                  id: c.id,
                  name: c.function.name,
                  args: safeParseArgs(c.function.arguments),
                  status: "pending",
                })),
              });
            }
          }
        );

        if (agg.usage) addUsage(agg.usage, settingsRef.current.model);

        // Commit the assistant turn. Preserve reasoning_content so the reasoner
        // model doesn't 400 on subsequent tool-calling turns.
        const assistantWire: ChatMessage = { role: "assistant", content: agg.content || "" };
        if (agg.reasoning) assistantWire.reasoning_content = agg.reasoning;
        if (agg.toolCalls.length) assistantWire.tool_calls = agg.toolCalls;
        wireRef.current = [...wireRef.current, assistantWire];

        if (!agg.toolCalls.length) {
          patchMessage(assistantId, { streaming: false });
          // Goal (Ralph) mode: if not done, re-issue the goal with fresh intent.
          if (goalMode && !completed && goalIterationRef.current < maxIter) {
            const nextIter = goalIterationRef.current + 1;
            goalIterationRef.current = nextIter;
            setGoalIteration(nextIter);
            wireRef.current = [
              ...wireRef.current,
              {
                role: "user",
                content:
                  `Continue working toward the goal:\n\n${goalRef.current}\n\n` +
                  `Make concrete progress this iteration. If the goal is fully met and verified, call task_complete.`,
              },
            ];
            setMessages((prev) => [
              ...prev,
              {
                id: uid("u"),
                role: "user",
                content: `↻ Goal iteration ${nextIter}/${maxIter}`,
                createdAt: Date.now(),
              },
            ]);
            continue;
          }
          break;
        }

        // Run any sub-agents in parallel (they need no approval, no ordering).
        const subCalls = agg.toolCalls.filter(
          (c) => c.function.name === "spawn_subagent"
        );
        const otherCalls = agg.toolCalls.filter(
          (c) => c.function.name !== "spawn_subagent"
        );

        if (subCalls.length) {
          const results = await Promise.all(
            subCalls.map((c) => runSubAgent(assistantId, c))
          );
          wireRef.current = [...wireRef.current, ...results];
        }

        for (const call of otherCalls) {
          const name = call.function.name;
          if (isClientTool(name)) {
            const { msg, complete } = await execClientTool(assistantId, call);
            wireRef.current = [...wireRef.current, msg];
            if (complete) completed = true;
            continue;
          }
          if (toolNeedsApproval(settingsRef.current, name)) {
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
          const toolMsg = await execServerTool(assistantId, call);
          wireRef.current = [...wireRef.current, toolMsg];
        }

        patchMessage(assistantId, { streaming: false });
        if (completed) break;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // user stopped — leave state as-is
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
      );
      runningRef.current = false;
      abortRef.current = null;
      setStatus("idle");
      persistCurrentSession();
    }
  }

  /* -------------------- session persistence -------------------- */

  const persistCurrentSession = useCallback(() => {
    const sess = sessionRef.current;
    if (!sess) return;
    setMessages((cur) => {
      if (cur.length === 0) return cur;
      const first = cur.find((m) => m.role === "user");
      saveSession({
        id: sess.id,
        title: deriveTitle(first?.content ?? "Session"),
        createdAt: sess.createdAt,
        updatedAt: Date.now(),
        model: settingsRef.current.model,
        messageCount: cur.length,
        usage: usageRef.current,
        messages: cur,
        wire: wireRef.current,
      });
      setSessions(loadSessionIndex());
      return cur;
    });
  }, []);

  /* -------------------- public actions -------------------- */

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || runningRef.current) return;
      // Start a new session lazily on the first message.
      if (!sessionRef.current) {
        sessionRef.current = { id: uid("s"), createdAt: Date.now() };
        setCurrentSessionId(sessionRef.current.id);
      }
      if (settingsRef.current.goalMode) {
        goalRef.current = trimmed;
        goalIterationRef.current = 0;
        setGoalIteration(0);
      }
      wireRef.current = [...wireRef.current, { role: "user", content: trimmed }];
      setMessages((prev) => [
        ...prev,
        { id: uid("u"), role: "user", content: trimmed, createdAt: Date.now() },
      ]);
      void runLoop();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    Array.from(approvalsRef.current.keys()).forEach((id) =>
      settleApproval(id, false)
    );
    Array.from(questionsRef.current.keys()).forEach((id) => {
      const e = questionsRef.current.get(id);
      questionsRef.current.delete(id);
      e?.resolve({});
    });
    setPendingQuestionIds(new Set());
    runningRef.current = false;
    setStatus("idle");
  }, []);

  const newSession = useCallback(() => {
    if (runningRef.current) abortRef.current?.abort();
    approvalsRef.current.clear();
    questionsRef.current.clear();
    wireRef.current = [];
    runningRef.current = false;
    sessionRef.current = null;
    setCurrentSessionId(null);
    setMessages([]);
    setPlan([]);
    setUsage(emptyUsageTotals());
    usageRef.current = emptyUsageTotals();
    goalIterationRef.current = 0;
    setGoalIteration(0);
    setAwaitingApprovalIds(new Set());
    setPendingQuestionIds(new Set());
    setError(null);
    setStatus("idle");
  }, []);

  const loadSessionById = useCallback(
    (id: string) => {
      const sess = loadSession(id);
      if (!sess) return;
      if (runningRef.current) abortRef.current?.abort();
      approvalsRef.current.clear();
      questionsRef.current.clear();
      runningRef.current = false;
      wireRef.current = sess.wire ?? [];
      sessionRef.current = { id: sess.id, createdAt: sess.createdAt };
      setCurrentSessionId(sess.id);
      setMessages(sess.messages ?? []);
      setUsage(sess.usage ?? emptyUsageTotals());
      usageRef.current = sess.usage ?? emptyUsageTotals();
      // Restore the latest plan, if any.
      const lastPlan = [...(sess.messages ?? [])]
        .reverse()
        .flatMap((m) => m.tools ?? [])
        .find((t) => t.meta?.plan)?.meta?.plan;
      setPlan(lastPlan ?? []);
      setAwaitingApprovalIds(new Set());
      setPendingQuestionIds(new Set());
      setError(null);
      setStatus("idle");
    },
    []
  );

  const removeSession = useCallback(
    (id: string) => {
      deleteSession(id);
      setSessions(loadSessionIndex());
      if (sessionRef.current?.id === id) newSession();
    },
    [newSession]
  );

  // Convenience setters backed by settings.
  const setModel = useCallback(
    (m: DeepSeekModel) => updateSettings({ model: m }),
    [updateSettings]
  );
  const setApprovalMode = useCallback(
    (a: ApprovalMode) => updateSettings({ approvalMode: a }),
    [updateSettings]
  );
  const setReasoningEffort = useCallback(
    (e: ReasoningEffort) => updateSettings({ reasoningEffort: e }),
    [updateSettings]
  );

  return useMemo(
    () => ({
      // conversation
      messages,
      status,
      busy,
      error,
      plan,
      usage,
      goalIteration,
      workspaceVersion,
      // settings
      settings,
      updateSettings,
      model: settings.model,
      setModel,
      approvalMode: settings.approvalMode,
      setApprovalMode,
      reasoningEffort: settings.reasoningEffort,
      setReasoningEffort,
      mcpTools,
      // sessions
      sessions,
      currentSessionId,
      newSession,
      loadSessionById,
      removeSession,
      // gates
      awaitingApprovalIds,
      pendingQuestionIds,
      approve,
      reject,
      approveAll,
      answerQuestion,
      // actions
      send,
      stop,
    }),
    [
      messages,
      status,
      busy,
      error,
      plan,
      usage,
      goalIteration,
      workspaceVersion,
      settings,
      updateSettings,
      setModel,
      setApprovalMode,
      setReasoningEffort,
      mcpTools,
      sessions,
      currentSessionId,
      newSession,
      loadSessionById,
      removeSession,
      awaitingApprovalIds,
      pendingQuestionIds,
      approve,
      reject,
      approveAll,
      answerQuestion,
      send,
      stop,
    ]
  );
}
