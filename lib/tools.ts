/**
 * Tool registry for the DeepSeek Codex agent.
 *
 * Exposes the OpenAI function-tool schemas advertised to the model, plus
 * executeTool() which actually runs each tool against the sandboxed workspace.
 * Every filesystem/shell operation is jailed inside the workspace via the
 * helpers in "@/lib/workspace".
 */
import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createTwoFilesPatch } from "diff";
import type { McpServerConfig, ToolResult } from "@/lib/types";
import { isMcpTool } from "@/lib/types";
import { callMcpTool } from "@/lib/mcp";
import {
  ensureWorkspace,
  resolveActiveRoot,
  resolveInWorkspace,
  toWorkspaceRelative,
  IGNORED_ENTRIES,
} from "@/lib/workspace";

const execAsync = promisify(exec);

/** Files larger than this are truncated when read, to protect the context window. */
const MAX_READ_BYTES = 64 * 1024;
/** Command stdout/stderr combined output is capped to this many chars. */
const MAX_COMMAND_OUTPUT = 16 * 1024;
const COMMAND_TIMEOUT_MS = 30_000;
const COMMAND_MAX_BUFFER = 1024 * 1024;
const LIST_MAX_DEPTH = 4;

/* ------------------------------------------------------------------ */
/* Tool schemas advertised to the model                               */
/* ------------------------------------------------------------------ */

export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a file in the workspace. Returns the file text. Large files are truncated.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file, relative to the workspace root.",
          },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Create a new file or fully overwrite an existing file with the given content. Returns a unified diff of the change.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file, relative to the workspace root.",
          },
          content: {
            type: "string",
            description: "The full new contents of the file.",
          },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description:
        "Replace an exact, unique substring in an existing file. old_string must appear exactly once. Use for small, targeted edits.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file, relative to the workspace root.",
          },
          old_string: {
            type: "string",
            description:
              "The exact text to replace. Must occur exactly once in the file.",
          },
          new_string: {
            type: "string",
            description: "The replacement text.",
          },
        },
        required: ["path", "old_string", "new_string"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "List files and directories under a path (defaults to the workspace root). Skips node_modules, .git, and similar.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Directory to list, relative to the workspace root. Defaults to the root.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Run a shell command in the workspace root and capture stdout, stderr, and the exit code. 30s timeout.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute.",
          },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },
];

/**
 * Schemas for tools the CLIENT orchestrates (planning, questions, sub-agents,
 * skills, memory, completion). They are advertised to the model here so they
 * appear in the stable cached tool prefix, but they are never executed on the
 * server — `useAgent` handles them. They touch no filesystem/shell.
 */
export const CLIENT_TOOL_SCHEMAS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "update_plan",
      description:
        "Create or update a live TODO checklist for multi-step work. Provide the full, ordered list of steps each time. Keep exactly one step 'in_progress'; mark finished steps 'completed'.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            description: "The ordered checklist.",
            items: {
              type: "object",
              properties: {
                step: { type: "string", description: "Short description of the step." },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                },
              },
              required: ["step", "status"],
            },
          },
        },
        required: ["steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description:
        "Ask the user up to a few clarifying multiple-choice questions and pause until they answer. Use only when the task is genuinely ambiguous and the answer changes what you do.",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string", description: "Full question, ends with '?'." },
                header: { type: "string", description: "Short label (≤12 chars)." },
                multiSelect: { type: "boolean" },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["label"],
                  },
                },
              },
              required: ["question", "header", "options"],
            },
          },
        },
        required: ["questions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spawn_subagent",
      description:
        "Delegate a self-contained sub-task to a fresh-context sub-agent. It cannot see this conversation, so inline all needed context (paths, errors, decisions) into the task. Returns only the sub-agent's final summary.",
      parameters: {
        type: "object",
        properties: {
          agent: {
            type: "string",
            description: "Which sub-agent profile to use (e.g. general, explorer, reviewer).",
          },
          task: {
            type: "string",
            description: "The complete, self-contained task for the sub-agent.",
          },
        },
        required: ["agent", "task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "use_skill",
      description:
        "Load the full instructions for one of the available skills before doing that kind of work. Returns the skill body.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The skill name to load." },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember",
      description:
        "Save a durable fact or user preference to long-term memory that persists across sessions. Use sparingly for things worth remembering.",
      parameters: {
        type: "object",
        properties: {
          note: { type: "string", description: "The fact/preference to remember." },
        },
        required: ["note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task_complete",
      description:
        "Signal that the user's goal is fully achieved and verified. In goal mode this stops the autonomous loop.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Short summary of what was accomplished." },
        },
        required: ["summary"],
      },
    },
  },
];

/* ------------------------------------------------------------------ */
/* Tool dispatch                                                       */
/* ------------------------------------------------------------------ */

export interface ToolContext {
  /** MCP servers configured by the client, for routing mcp__ tool calls. */
  mcpServers?: McpServerConfig[];
  /** The active workspace root (the folder the user opened). */
  root?: string;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext = {}
): Promise<ToolResult> {
  try {
    // MCP tools (mcp__server__tool) route to the configured remote server.
    if (isMcpTool(name)) {
      return await callMcpTool(ctx.mcpServers ?? [], name, args);
    }
    const root = await resolveActiveRoot(ctx.root);
    switch (name) {
      case "read_file":
        return await readFileTool(args, root);
      case "write_file":
        return await writeFileTool(args, root);
      case "edit_file":
        return await editFileTool(args, root);
      case "list_files":
        return await listFilesTool(args, root);
      case "run_command":
        return await runCommandTool(args, root);
      default:
        return { ok: false, output: `Error: unknown tool "${name}".` };
    }
  } catch (err) {
    return { ok: false, output: `Error: ${errMessage(err)}` };
  }
}

/* ------------------------------------------------------------------ */
/* Individual tools                                                    */
/* ------------------------------------------------------------------ */

async function readFileTool(
  args: Record<string, unknown>,
  root: string
): Promise<ToolResult> {
  await ensureWorkspace(root);
  const rel = requireString(args, "path");
  const abs = resolveInWorkspace(rel, root);
  const displayPath = toWorkspaceRelative(abs, root);

  const stat = await fs.stat(abs);
  if (stat.isDirectory()) {
    return {
      ok: false,
      output: `Error: "${displayPath}" is a directory, not a file. Use list_files instead.`,
      meta: { path: displayPath },
    };
  }

  const raw = await fs.readFile(abs);
  if (raw.byteLength > MAX_READ_BYTES) {
    const truncated = raw.subarray(0, MAX_READ_BYTES).toString("utf8");
    return {
      ok: true,
      output: `${truncated}\n\n[... truncated: file is ${raw.byteLength} bytes, showing first ${MAX_READ_BYTES} bytes ...]`,
      meta: { path: displayPath },
    };
  }

  return {
    ok: true,
    output: raw.toString("utf8"),
    meta: { path: displayPath },
  };
}

async function writeFileTool(
  args: Record<string, unknown>,
  root: string
): Promise<ToolResult> {
  await ensureWorkspace(root);
  const rel = requireString(args, "path");
  const content = requireString(args, "content");
  const abs = resolveInWorkspace(rel, root);
  const displayPath = toWorkspaceRelative(abs, root);

  // Read prior contents (if any) so we can produce a meaningful diff.
  let before = "";
  let existed = false;
  try {
    before = await fs.readFile(abs, "utf8");
    existed = true;
  } catch {
    existed = false;
  }

  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");

  const diff = createTwoFilesPatch(
    displayPath,
    displayPath,
    before,
    content,
    existed ? "before" : "(new file)",
    "after"
  );

  const bytes = Buffer.byteLength(content, "utf8");
  return {
    ok: true,
    output: `Wrote ${bytes} bytes to ${displayPath}${existed ? "" : " (new file)"}.`,
    meta: {
      path: displayPath,
      diff,
      before,
      after: content,
      mutated: true,
    },
  };
}

async function editFileTool(
  args: Record<string, unknown>,
  root: string
): Promise<ToolResult> {
  await ensureWorkspace(root);
  const rel = requireString(args, "path");
  const oldString = requireString(args, "old_string");
  const newString = requireString(args, "new_string");
  const abs = resolveInWorkspace(rel, root);
  const displayPath = toWorkspaceRelative(abs, root);

  let before: string;
  try {
    before = await fs.readFile(abs, "utf8");
  } catch {
    return {
      ok: false,
      output: `Error: cannot edit "${displayPath}" because it does not exist. Use write_file to create it.`,
      meta: { path: displayPath },
    };
  }

  const occurrences = countOccurrences(before, oldString);
  if (occurrences === 0) {
    return {
      ok: false,
      output: `Error: old_string was not found in "${displayPath}". Read the file and copy the exact text (including whitespace) you want to replace.`,
      meta: { path: displayPath },
    };
  }
  if (occurrences > 1) {
    return {
      ok: false,
      output: `Error: old_string occurs ${occurrences} times in "${displayPath}". It must be unique. Include more surrounding context so it matches exactly once.`,
      meta: { path: displayPath },
    };
  }

  // Index-based splice (not String.replace) so "$" sequences in new_string
  // are inserted literally rather than treated as replacement patterns.
  const at = before.indexOf(oldString);
  const after =
    before.slice(0, at) + newString + before.slice(at + oldString.length);
  await fs.writeFile(abs, after, "utf8");

  const diff = createTwoFilesPatch(
    displayPath,
    displayPath,
    before,
    after,
    "before",
    "after"
  );

  return {
    ok: true,
    output: `Edited ${displayPath} (replaced 1 occurrence).`,
    meta: {
      path: displayPath,
      diff,
      before,
      after,
      mutated: true,
    },
  };
}

async function listFilesTool(
  args: Record<string, unknown>,
  root: string
): Promise<ToolResult> {
  await ensureWorkspace(root);
  const rel = typeof args.path === "string" && args.path ? args.path : ".";
  const abs = resolveInWorkspace(rel, root);
  const displayPath = toWorkspaceRelative(abs, root) || ".";

  let baseStat;
  try {
    baseStat = await fs.stat(abs);
  } catch {
    return {
      ok: false,
      output: `Error: "${displayPath}" does not exist.`,
      meta: { path: displayPath },
    };
  }
  if (!baseStat.isDirectory()) {
    return {
      ok: false,
      output: `Error: "${displayPath}" is a file, not a directory. Use read_file instead.`,
      meta: { path: displayPath },
    };
  }

  const entries: string[] = [];
  await walk(abs, 0);

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > LIST_MAX_DEPTH) return;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    dirents.sort((a, b) => {
      // Directories first, then alphabetical.
      const aDir = a.isDirectory() ? 0 : 1;
      const bDir = b.isDirectory() ? 0 : 1;
      if (aDir !== bDir) return aDir - bDir;
      return a.name.localeCompare(b.name);
    });
    for (const dirent of dirents) {
      if (IGNORED_ENTRIES.has(dirent.name)) continue;
      const childAbs = path.join(dir, dirent.name);
      const childRel = path.relative(root, childAbs).split(path.sep).join("/");
      if (dirent.isDirectory()) {
        entries.push(`${childRel}/`);
        await walk(childAbs, depth + 1);
      } else {
        entries.push(childRel);
      }
    }
  }

  const output =
    entries.length > 0
      ? entries.join("\n")
      : `(empty directory: ${displayPath})`;

  return {
    ok: true,
    output,
    meta: { path: displayPath, entries },
  };
}

async function runCommandTool(
  args: Record<string, unknown>,
  root: string
): Promise<ToolResult> {
  const cwd = await ensureWorkspace(root);
  const command = requireString(args, "command");

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: COMMAND_MAX_BUFFER,
    });
    const out = combineOutput(stdout, stderr);
    return {
      ok: true,
      output: out || "(no output)",
      meta: {
        command,
        stdout,
        stderr,
        exitCode: 0,
      },
    };
  } catch (err) {
    const e = err as ExecError;
    // A non-zero exit is NOT an execution failure — surface it to the model.
    if (typeof e.code === "number") {
      const stdout = e.stdout ?? "";
      const stderr = e.stderr ?? "";
      const out = combineOutput(stdout, stderr);
      return {
        ok: true,
        output: `${out ? out + "\n" : ""}[exit code ${e.code}]`,
        meta: {
          command,
          stdout,
          stderr,
          exitCode: e.code,
        },
      };
    }
    // Killed (timeout) or could not be spawned (command not found, etc.).
    if (e.killed) {
      return {
        ok: false,
        output: `Error: command timed out after ${COMMAND_TIMEOUT_MS / 1000}s: ${command}`,
        meta: { command, stdout: e.stdout ?? "", stderr: e.stderr ?? "" },
      };
    }
    return {
      ok: false,
      output: `Error: failed to run command: ${errMessage(err)}`,
      meta: { command, stdout: e.stdout ?? "", stderr: e.stderr ?? "" },
    };
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface ExecError {
  code?: number | string;
  killed?: boolean;
  stdout?: string;
  stderr?: string;
  message?: string;
}

function combineOutput(stdout: string, stderr: string): string {
  let combined = "";
  if (stdout) combined += stdout;
  if (stderr) combined += (combined ? "\n" : "") + stderr;
  if (combined.length > MAX_COMMAND_OUTPUT) {
    return (
      combined.slice(0, MAX_COMMAND_OUTPUT) +
      `\n[... truncated: output exceeded ${MAX_COMMAND_OUTPUT} chars ...]`
    );
  }
  return combined;
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle === "") return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new Error(`missing or invalid "${key}" (expected a string).`);
  }
  return value;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
