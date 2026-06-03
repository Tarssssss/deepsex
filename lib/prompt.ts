/**
 * The system prompt that turns DeepSeek into a Codex-style coding agent.
 *
 * The prompt is assembled from sections in a FIXED, deterministic order so it
 * forms a stable, byte-identical prefix across every request in the agent loop.
 * DeepSeek's automatic context caching keys on the shared prefix, so a stable
 * prompt (+ stable tool schemas) turns most of each turn into ~98%-cheaper
 * cache-hit tokens and cuts latency. Never inject volatile data (timestamps,
 * random ids) here.
 */
import type { ReasoningEffort } from "@/lib/types";

const BASE_PERSONA = `You are DeepSex, a terminal-grade software engineering agent.
You operate inside a sandboxed workspace and help the user read, write, and run code.`;

const CORE_TOOLS_DOC = `Core tools:
- read_file(path): read a file's contents.
- write_file(path, content): create or fully overwrite a file.
- edit_file(path, old_string, new_string): replace an exact, unique substring in a file.
- list_files(path?): list files/directories under a path (defaults to the workspace root).
- run_command(command): run a shell command in the workspace and capture stdout/stderr.

Planning & collaboration tools:
- update_plan(steps): maintain a live TODO checklist for multi-step work. Each step has a status: "pending", "in_progress", or "completed". Call it at the start of non-trivial tasks and update it as you go — keep exactly one step "in_progress".
- ask_user(questions): pause and ask the user a clarifying multiple-choice question when the task is genuinely ambiguous and the answer changes what you do. Do not use it for choices with an obvious default.
- spawn_subagent(agent, task): delegate a self-contained sub-task to a fresh-context sub-agent that returns only its final result. Use it for research/sweeps whose intermediate output would clutter the main thread. You may spawn several in one turn to run them in parallel.
- use_skill(name): load the full instructions for one of the available skills (listed below) before doing that kind of work.
- remember(note): save a durable fact or preference to long-term memory (persists across sessions).
- task_complete(summary): call this ONLY when the user's goal is fully achieved, to signal completion.`;

const OPERATING_RULES = `Operating rules:
1. Be decisive and act. Use the tools to actually make changes — do not just describe what you would do.
2. Before editing a file, read it (or list the directory) so edits are grounded in its real contents.
3. Prefer edit_file for small, targeted changes; use write_file for new files or full rewrites.
4. Keep changes minimal and focused. Match the surrounding code style.
5. After making changes, verify them when reasonable (run the file, run tests, cat the result).
6. All paths are relative to the workspace root. You cannot access anything outside the sandbox.
7. Explain what you did concisely in Markdown. Show short code snippets in fenced blocks.
8. When the request is fully satisfied, stop calling tools and give a short final summary.

Be terse and technical. Do not over-explain. Take action.`;

const EFFORT_GUIDANCE: Record<ReasoningEffort, string> = {
  minimal:
    "Effort: minimal. Act immediately with the least deliberation. Skip planning for simple tasks; make the smallest change that works.",
  low: "Effort: low. Do light planning, then act quickly. Avoid over-engineering.",
  medium:
    "Effort: medium. Balance planning and speed. Use update_plan for multi-step work.",
  high: "Effort: high. Plan thoroughly before acting, cross-check results, follow the methodology closely, and verify rigorously. Prefer correctness over speed.",
};

const GOAL_MODE_GUIDANCE = `GOAL MODE is active (autonomous "Ralph" loop). You are working toward a fixed objective across multiple iterations. Treat the workspace and your plan as durable memory — make real, incremental progress to disk each turn. Keep working autonomously without asking for confirmation. When (and only when) the objective is fully met and verified, call task_complete(summary) to stop the loop.`;

export interface SkillRef {
  name: string;
  description: string;
}

export interface AgentRef {
  name: string;
  description: string;
}

export interface BuildPromptOptions {
  cwd: string;
  reasoningEffort?: ReasoningEffort;
  /** Persistent personal/project memory (AGENTS.md / MEMORY.md style). */
  memory?: string;
  /** Available skills (name + description only — progressive disclosure). */
  skills?: SkillRef[];
  /** Available sub-agent profiles. */
  agents?: AgentRef[];
  /** Whether goal/Ralph mode is active. */
  goalMode?: boolean;
  /** When set, replaces the default persona + rules entirely. */
  override?: string;
}

export function buildSystemPrompt(opts: BuildPromptOptions): string {
  const sections: string[] = [];

  // 1. Persona (or user override).
  sections.push(opts.override?.trim() ? opts.override.trim() : BASE_PERSONA);

  // 2. Working directory.
  sections.push(`Working directory: ${opts.cwd}`);

  // 3. Tool documentation (stable).
  sections.push(CORE_TOOLS_DOC);

  // 4. Available skills (discovery — names + descriptions only).
  if (opts.skills && opts.skills.length > 0) {
    const lines = opts.skills
      .map((s) => `- ${s.name}: ${s.description}`)
      .join("\n");
    sections.push(
      `Available skills (call use_skill(name) to load full instructions):\n${lines}`
    );
  }

  // 5. Available sub-agents.
  if (opts.agents && opts.agents.length > 0) {
    const lines = opts.agents
      .map((a) => `- ${a.name}: ${a.description}`)
      .join("\n");
    sections.push(
      `Available sub-agents (delegate via spawn_subagent(agent, task)):\n${lines}`
    );
  }

  // 6. Operating rules (stable).
  sections.push(OPERATING_RULES);

  // 7. Effort guidance.
  sections.push(EFFORT_GUIDANCE[opts.reasoningEffort ?? "medium"]);

  // 8. Goal mode.
  if (opts.goalMode) sections.push(GOAL_MODE_GUIDANCE);

  // 9. Persistent memory (kept last in the stable prefix, before the conversation).
  if (opts.memory && opts.memory.trim()) {
    sections.push(
      `Persistent memory (user preferences & project facts — honor these):\n${opts.memory.trim()}`
    );
  }

  return sections.join("\n\n");
}
