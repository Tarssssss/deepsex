/**
 * Built-in Skills + sub-agent profiles.
 *
 * Skills follow the "Agent Skills" progressive-disclosure model: only each
 * skill's `name` + `description` is injected into the system prompt (cheap,
 * always-on discovery). The full `body` is loaded into the conversation only
 * when the model invokes the skill via the `use_skill` tool — keeping long
 * reference material out of the context until it's actually needed.
 *
 * Sub-agent profiles define focused personas the main agent can delegate to
 * via `spawn_subagent`; each runs in its own fresh context and returns only its
 * final answer to the parent (the core context-saving mechanism).
 */
import type { AgentProfile, Skill } from "@/lib/types";

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: "skill-pr-summary",
    name: "summarize-changes",
    description:
      "Summarize uncommitted changes and draft a commit message. Use when the user asks what changed, wants a commit message, or asks to review their diff.",
    body: [
      "Summarize the current workspace changes:",
      "1. Run `git status --short` and `git diff` (and `git diff --staged`) via run_command.",
      "2. Group the changes by area and explain what each one does and why.",
      "3. Flag anything risky (secrets, large deletions, debug code, TODOs left behind).",
      "4. Propose a concise Conventional-Commits message (e.g. `feat: ...`, `fix: ...`).",
      "Keep it tight — bullets, not prose.",
    ].join("\n"),
    builtin: true,
  },
  {
    id: "skill-tests",
    name: "write-tests",
    description:
      "Write and run a focused test suite for a file or function. Use when the user asks for tests, wants coverage, or wants to verify behavior.",
    body: [
      "Add tests for the target code:",
      "1. Read the target file and any existing test setup (package.json scripts, test config).",
      "2. Match the project's existing test framework and conventions — do not introduce a new one.",
      "3. Cover the happy path, edge cases, and at least one failure case.",
      "4. Run the tests with run_command and iterate until they pass.",
      "5. Report what you covered and the final test output.",
    ].join("\n"),
    builtin: true,
  },
  {
    id: "skill-debug",
    name: "debug-issue",
    description:
      "Systematically debug a failing program or test. Use when something errors, crashes, or behaves unexpectedly.",
    body: [
      "Debug methodically — do not guess-and-check blindly:",
      "1. Reproduce the failure with run_command and read the full error/stack trace.",
      "2. Form a hypothesis about the root cause; locate the relevant code with list_files/read_file.",
      "3. Make the smallest change that tests the hypothesis.",
      "4. Re-run to confirm. If wrong, revise the hypothesis — don't pile on changes.",
      "5. Once fixed, run the broader suite to check for regressions, then summarize the root cause.",
    ].join("\n"),
    builtin: true,
  },
  {
    id: "skill-explain",
    name: "explain-codebase",
    description:
      "Produce a clear walkthrough of a codebase or module. Use when the user asks how the project works, where something lives, or for an architecture overview.",
    body: [
      "Explain the codebase:",
      "1. list_files at the root to map the structure.",
      "2. Read the entry points and key modules (config, main, routes, core libs).",
      "3. Describe the architecture: data flow, responsibilities, and how pieces connect.",
      "4. Point to specific files for each concept so the user can navigate.",
      "Prefer a short architecture summary + a file-by-file map over exhaustive detail.",
    ].join("\n"),
    builtin: true,
  },
];

export const BUILTIN_AGENTS: AgentProfile[] = [
  {
    id: "agent-general",
    name: "general",
    description:
      "General-purpose worker for a focused sub-task. Use for self-contained work whose intermediate steps would clutter the main thread.",
    prompt:
      "You are a focused sub-agent. Complete the single task you are given using the available tools, then report a concise result. You do not see the parent conversation, so rely only on the task description and what you can read from the workspace. Be decisive and end with a short summary of what you did and the outcome.",
    builtin: true,
  },
  {
    id: "agent-explorer",
    name: "explorer",
    description:
      "Read-only research agent. Use to search/read across many files and return just the conclusion (e.g. 'where is X handled?', 'how does Y work?').",
    prompt:
      "You are a read-only research sub-agent. Investigate the question by reading and listing files. Do NOT modify anything. Return a tight, concrete answer with the specific files and line references that support it.",
    tools: ["read_file", "list_files", "run_command"],
    builtin: true,
  },
  {
    id: "agent-reviewer",
    name: "reviewer",
    description:
      "Code reviewer. Use to review a diff or file for correctness bugs and obvious cleanups; returns prioritized findings.",
    prompt:
      "You are a code-review sub-agent. Review the specified changes or files for correctness bugs first, then clear simplifications. Return prioritized findings (most important first) with file:line references and concrete suggested fixes. Do not make edits yourself unless explicitly asked.",
    tools: ["read_file", "list_files", "run_command"],
    builtin: true,
  },
];

/** Merge built-in skills with the user's custom ones, honoring disabled list. */
export function activeSkills(
  custom: Skill[] = [],
  disabled: string[] = []
): Skill[] {
  const all = [...BUILTIN_SKILLS, ...custom];
  return all.filter((s) => !disabled.includes(s.name));
}
