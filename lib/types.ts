/**
 * Shared contracts for DeepSex.
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
}

export const MODELS: ModelInfo[] = [
  {
    id: "deepseek-chat",
    // "deepseek-chat" is a stable alias for DeepSeek's latest non-reasoning
    // model (currently V4 Flash); keep the label version-agnostic.
    label: "DeepSeek Chat",
    description: "Fast general-purpose coding model (latest)",
    reasoning: false,
  },
  {
    id: "deepseek-reasoner",
    label: "DeepSeek Reasoner",
    description: "Deep reasoning model — shows its thinking",
    reasoning: true,
  },
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
  | "run_command";

/** Which tools are "edits" vs "commands", used to decide approval. */
export const FILE_MUTATING_TOOLS: ToolName[] = ["write_file", "edit_file"];
export const COMMAND_TOOLS: ToolName[] = ["run_command"];

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
  | { type: "done"; finishReason: string | null }
  | { type: "error"; message: string };

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
