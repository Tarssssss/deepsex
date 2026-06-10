/**
 * Shared contracts for DeepSeek Codex.
 *
 * These types are the single source of truth shared between the server
 * (agent loop + tools) and the client (chat UI + agent orchestration hook).
 * Both sides import from here — do not redefine these shapes elsewhere.
 */

/* ------------------------------------------------------------------ */
/* DeepSeek / OpenAI-compatible wire format                            */
/* ------------------------------------------------------------------ */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    /** JSON-encoded arguments (may be a partial fragment while streaming). */
    arguments: string;
  };
}

/** A message in the OpenAI-compatible conversation sent to DeepSeek. */
export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  /** Chain-of-thought, only present on assistant turns from deepseek-reasoner. */
  reasoning_content?: string | null;
  /** Present on assistant turns that call tools. */
  tool_calls?: ToolCall[];
  /** Present on tool-result messages; references the ToolCall.id. */
  tool_call_id?: string;
  /** Tool name, for tool-result messages. */
  name?: string;
}

/* ------------------------------------------------------------------ */
/* Models + approval policy                                            */
/* ------------------------------------------------------------------ */

export type DeepSeekModel = "deepseek-chat" | "deepseek-reasoner";

export interface ModelInfo {
  id: DeepSeekModel;
  label: string;
  description: string;
  /** Whether this model streams a separate reasoning_content channel. */
  reasoning: boolean;
  /** Context window in tokens (for usage visualization). */
  contextWindow: number;
  /**
   * USD price per 1M tokens. DeepSeek bills cache hits far cheaper than misses
   * (automatic context caching), so we track all three to estimate real cost.
   */
  pricing: {
    cacheHit: number;
    cacheMiss: number;
    output: number;
  };
}

export const MODELS: ModelInfo[] = [
  {
    id: "deepseek-chat",
    // "deepseek-chat" is a stable alias for DeepSeek's latest non-reasoning
    // model (currently V4 Flash, non-thinking); keep the label version-agnostic.
    label: "DeepSeek Chat",
    description: "Fast general-purpose coding model (V4)",
    reasoning: false,
    // V4 ships a 1M-token context window.
    contextWindow: 1_000_000,
    // DeepSeek V4-Flash list pricing (USD / 1M tokens). Cache hits are ~98%
    // cheaper than misses thanks to automatic prefix caching.
    pricing: { cacheHit: 0.0028, cacheMiss: 0.14, output: 0.28 },
  },
  {
    id: "deepseek-reasoner",
    // Stable alias for V4 with thinking enabled — shows chain-of-thought.
    label: "DeepSeek Reasoner",
    description: "Deep reasoning model — shows its thinking (V4)",
    reasoning: true,
    contextWindow: 1_000_000,
    pricing: { cacheHit: 0.0028, cacheMiss: 0.14, output: 0.28 },
  },
];

/* ------------------------------------------------------------------ */
/* Reasoning effort                                                    */
/* ------------------------------------------------------------------ */

/**
 * Reasoning effort, mirroring Codex's `model_reasoning_effort`. Controls how
 * much the model deliberates before acting. For deepseek-reasoner this is
 * forwarded as `reasoning_effort`; for non-reasoning models it is folded into
 * the system prompt as a behavioral hint (and a small temperature nudge).
 */
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export interface ReasoningEffortInfo {
  id: ReasoningEffort;
  label: string;
  description: string;
}

export const REASONING_EFFORTS: ReasoningEffortInfo[] = [
  { id: "minimal", label: "Minimal", description: "Fastest — act with little deliberation" },
  { id: "low", label: "Low", description: "Quick, light planning" },
  { id: "medium", label: "Medium", description: "Balanced planning and speed" },
  { id: "high", label: "High", description: "Deep planning for hard tasks" },
];

/**
 * Approval policy, mirroring Codex's modes:
 *  - suggest   : every tool call needs explicit user approval
 *  - auto-edit : file reads/writes/edits auto-approved; shell commands need approval
 *  - full-auto : everything runs automatically
 */
export type ApprovalMode = "suggest" | "auto-edit" | "full-auto";

export interface ApprovalModeInfo {
  id: ApprovalMode;
  label: string;
  description: string;
}

export const APPROVAL_MODES: ApprovalModeInfo[] = [
  {
    id: "suggest",
    label: "Suggest",
    description: "Approve every action",
  },
  {
    id: "auto-edit",
    label: "Auto Edit",
    description: "Auto-apply file edits, approve commands",
  },
  {
    id: "full-auto",
    label: "Full Auto",
    description: "Run everything automatically",
  },
];

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

export type ToolName =
  | "read_file"
  | "write_file"
  | "edit_file"
  | "list_files"
  | "run_command"
  // Codex-style planning + agentic tools (handled client-side):
  | "update_plan"
  | "ask_user"
  | "spawn_subagent"
  | "use_skill"
  | "remember"
  | "task_complete";

/** Which tools are "edits" vs "commands", used to decide approval. */
export const FILE_MUTATING_TOOLS: ToolName[] = ["write_file", "edit_file"];
export const COMMAND_TOOLS: ToolName[] = ["run_command"];

/**
 * Tools the client orchestrates itself instead of POSTing to /api/tool:
 * planning, interactive questions, sub-agents, skills, memory, goal completion.
 * These never touch the filesystem/shell, so they are always auto-approved.
 */
export const CLIENT_TOOLS: ToolName[] = [
  "update_plan",
  "ask_user",
  "spawn_subagent",
  "use_skill",
  "remember",
  "task_complete",
];

/** MCP tools are namespaced `mcp__<server>__<tool>` (Codex/Claude convention). */
export const MCP_TOOL_PREFIX = "mcp__";
export function isMcpTool(name: string): boolean {
  return name.startsWith(MCP_TOOL_PREFIX);
}

export type ToolStatus =
  | "pending" // model proposed it; awaiting approval/exec
  | "running" // currently executing
  | "success"
  | "error"
  | "rejected"; // user declined

/** A single tool call as tracked by the UI. */
export interface ToolInvocation {
  /** Matches ToolCall.id. */
  id: string;
  name: ToolName | string;
  args: Record<string, unknown>;
  status: ToolStatus;
  /** Text result fed back to the model. */
  result?: string;
  error?: string;
  /** Extra structured info for rich rendering (diffs, paths, exit codes). */
  meta?: ToolResultMeta;
}

export interface ToolResultMeta {
  path?: string;
  /** Unified diff for write_file / edit_file. */
  diff?: string;
  before?: string;
  after?: string;
  exitCode?: number;
  command?: string;
  stdout?: string;
  stderr?: string;
  /** For list_files. */
  entries?: string[];
  /** Whether this tool mutated the workspace (used to refresh file tree). */
  mutated?: boolean;
  /** For update_plan: the current checklist. */
  plan?: PlanStep[];
  /** For ask_user: the question(s) posed and (once answered) the answers. */
  questions?: UserQuestion[];
  answers?: Record<string, string>;
  /** For spawn_subagent: nested run summary. */
  subagent?: SubAgentRun;
  /** For use_skill: which skill was loaded. */
  skill?: string;
  /** Whether this tool came from an MCP server (and which one). */
  mcpServer?: string;
}

/* ------------------------------------------------------------------ */
/* Plan tool (Codex-style live TODO checklist)                         */
/* ------------------------------------------------------------------ */

export type PlanStepStatus = "pending" | "in_progress" | "completed";

export interface PlanStep {
  step: string;
  status: PlanStepStatus;
}

/* ------------------------------------------------------------------ */
/* Ask-user tool (clarifying questions)                                */
/* ------------------------------------------------------------------ */

export interface UserQuestionOption {
  label: string;
  description?: string;
}

export interface UserQuestion {
  /** Full question text, ends with "?". */
  question: string;
  /** Short chip label (≤12 chars). */
  header: string;
  options: UserQuestionOption[];
  multiSelect?: boolean;
}

/* ------------------------------------------------------------------ */
/* Sub-agents                                                          */
/* ------------------------------------------------------------------ */

export interface SubAgentRun {
  /** The named agent profile used, if any. */
  agent?: string;
  task: string;
  /** Final assistant text returned to the parent. */
  result: string;
  /** Turns the sub-agent took. */
  turns: number;
  status: "running" | "success" | "error";
  /** Tool calls the sub-agent made (for the nested timeline). */
  tools?: ToolInvocation[];
}

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  /** The sub-agent's system prompt. */
  prompt: string;
  /** Allowed tool names; empty = inherit the standard file/command tools. */
  tools?: ToolName[];
  builtin?: boolean;
}

/** Response body from POST /api/tool. */
export interface ToolResult {
  ok: boolean;
  /** Text output that becomes the `tool` role message content. */
  output: string;
  meta?: ToolResultMeta;
}

/* ------------------------------------------------------------------ */
/* Streaming protocol (SSE from POST /api/chat)                        */
/* ------------------------------------------------------------------ */

/**
 * One assistant turn is streamed as a sequence of these events,
 * newline-delimited JSON (one event per line, NDJSON).
 */
export type StreamEvent =
  | { type: "reasoning"; delta: string }
  | { type: "content"; delta: string }
  | { type: "tool_calls"; calls: ToolCall[] }
  | { type: "usage"; usage: TokenUsage }
  | { type: "done"; finishReason: string | null }
  | { type: "error"; message: string };

/* ------------------------------------------------------------------ */
/* Token usage + cost (DeepSeek automatic context caching)             */
/* ------------------------------------------------------------------ */

/**
 * Usage as reported by DeepSeek (OpenAI-compatible). DeepSeek splits prompt
 * tokens into cache-hit vs cache-miss buckets — cache hits are ~98% cheaper —
 * so we track both to estimate real cost and show the cache hit rate.
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  reasoning_tokens?: number;
}

/** Running totals accumulated across all turns of a session. */
export interface UsageTotals extends TokenUsage {
  /** Number of model turns counted. */
  turns: number;
  /** Estimated cost in USD. */
  costUsd: number;
}

export function emptyUsageTotals(): UsageTotals {
  return {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: 0,
    reasoning_tokens: 0,
    turns: 0,
    costUsd: 0,
  };
}

/** Estimate USD cost of one usage record for a given model. */
export function estimateCost(usage: TokenUsage, model: DeepSeekModel): number {
  const info = MODELS.find((m) => m.id === model) ?? MODELS[0];
  const hit = usage.prompt_cache_hit_tokens ?? 0;
  const miss =
    usage.prompt_cache_miss_tokens ??
    Math.max(0, usage.prompt_tokens - hit);
  const out = usage.completion_tokens;
  return (
    (hit / 1_000_000) * info.pricing.cacheHit +
    (miss / 1_000_000) * info.pricing.cacheMiss +
    (out / 1_000_000) * info.pricing.output
  );
}

/* ------------------------------------------------------------------ */
/* Skills (progressive-disclosure instruction bundles)                 */
/* ------------------------------------------------------------------ */

export interface Skill {
  id: string;
  /** lowercase-hyphen name, invoked as a slash command or via use_skill. */
  name: string;
  /** What it does AND when to use it — injected into the prompt for discovery. */
  description: string;
  /** The full instruction body, loaded only when the skill is invoked. */
  body: string;
  builtin?: boolean;
}

/* ------------------------------------------------------------------ */
/* MCP (Model Context Protocol) servers                                */
/* ------------------------------------------------------------------ */

export interface McpServerConfig {
  id: string;
  name: string;
  /** Streamable-HTTP MCP endpoint URL. */
  url: string;
  /** Optional auth/other headers. */
  headers?: Record<string, string>;
  enabled: boolean;
}

export interface McpToolInfo {
  /** Namespaced tool name: mcp__<server>__<tool>. */
  name: string;
  server: string;
  description: string;
  parameters: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Persistent settings (personal memory + preferences)                 */
/* ------------------------------------------------------------------ */

export type ThemePref = "light" | "dark" | "system";

export interface AgentSettings {
  theme: ThemePref;
  /**
   * DeepSeek API key entered in the UI (stored locally in the browser, sent
   * per request). Lets users start without editing .env — falls back to the
   * server's DEEPSEEK_API_KEY env var when empty.
   */
  deepseekApiKey: string;
  model: DeepSeekModel;
  approvalMode: ApprovalMode;
  reasoningEffort: ReasoningEffort;
  /** When set, replaces the default system prompt entirely. */
  systemPromptOverride: string;
  /** Persistent personal/project memory, injected into the prompt prefix. */
  memory: string;
  /** Goal (Ralph) mode config. */
  goalMode: boolean;
  goalMaxIterations: number;
  /** Names of skills the user has enabled (besides built-ins). */
  customSkills: Skill[];
  disabledSkills: string[];
  mcpServers: McpServerConfig[];
  /**
   * Active workspace root — the local folder the user opened (opencode-style).
   * Empty string means use the server's default AGENT_WORKSPACE.
   */
  workspaceRoot: string;
}

export const DEFAULT_SETTINGS: AgentSettings = {
  theme: "system",
  deepseekApiKey: "",
  model: "deepseek-chat",
  approvalMode: "auto-edit",
  reasoningEffort: "medium",
  systemPromptOverride: "",
  memory: "",
  goalMode: false,
  goalMaxIterations: 12,
  customSkills: [],
  disabledSkills: [],
  mcpServers: [],
  workspaceRoot: "",
};

/* ------------------------------------------------------------------ */
/* Folder browsing (the "open a folder" picker)                        */
/* ------------------------------------------------------------------ */

export interface BrowseDirEntry {
  name: string;
  path: string;
}

export interface BrowseResponse {
  path: string;
  parent: string | null;
  dirs: BrowseDirEntry[];
  home: string;
  defaultRoot: string;
}

/* ------------------------------------------------------------------ */
/* Sessions (Codex-style rollout persistence)                          */
/* ------------------------------------------------------------------ */

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: DeepSeekModel;
  messageCount: number;
  usage: UsageTotals;
}

export interface StoredSession extends SessionMeta {
  /** UI-facing rendered messages. */
  messages: UIMessage[];
  /** Wire-format conversation replayed to the model on resume. */
  wire: ChatMessage[];
}

/* ------------------------------------------------------------------ */
/* Custom agents (ccswitch-style provider/persona profiles)            */
/* ------------------------------------------------------------------ */

/** Accent swatches for agent avatars (all readable with white text). */
export const ACCENT_SWATCHES = [
  "#4d6bfe", // brand blue
  "#2ea043", // green
  "#d97706", // amber
  "#e5484d", // red
  "#8b5cf6", // violet
  "#0ea5e9", // sky
  "#ec4899", // pink
  "#14b8a6", // teal
];

/**
 * A user-configured agent: its own OpenAI-compatible provider, model, key, and
 * system prompt. Lives entirely client-side; the API key is sent only to the
 * provider (via a stateless server passthrough), never persisted server-side.
 */
export interface CustomAgent {
  id: string;
  name: string;
  description: string;
  accent: string;
  /** OpenAI-compatible base URL, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  createdAt: number;
}

export interface CustomAgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
}

/* ------------------------------------------------------------------ */
/* UI-facing message model                                             */
/* ------------------------------------------------------------------ */

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  tools?: ToolInvocation[];
  /** True while this assistant message is still streaming/looping. */
  streaming?: boolean;
  createdAt: number;
}

/* ------------------------------------------------------------------ */
/* File tree (GET /api/files, GET /api/file)                           */
/* ------------------------------------------------------------------ */

export interface FileNode {
  name: string;
  /** Path relative to the workspace root. */
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}
