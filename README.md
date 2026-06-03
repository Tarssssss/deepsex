# DeepSex

A Codex-style AI coding agent, powered by the **DeepSeek** API and dressed in
DeepSeek's design language (brand blue `#4D6BFE`, light + dark themes).

It reads, writes, edits, and runs code inside a sandboxed workspace — driven by a
streaming agent loop with tool calling, just like Codex.

![DeepSex](public/window.svg)

## Features

- **Streaming chat** with `deepseek-chat` and `deepseek-reasoner` (DeepSeek V4 — 1M
  context, shows its thinking). Tuned for V4: temperature 0 for coding,
  `parallel_tool_calls`, and `reasoning_content` preserved across tool-calling turns.
- **Agent tool loop** — the model plans, calls tools, sees the results, and continues until done.
- **Core sandbox tools**: `read_file`, `write_file`, `edit_file` (exact-match patch),
  `list_files`, `run_command` — all jailed to the workspace.
- **Codex-style agentic tools**:
  - **`update_plan`** — a live TODO checklist (pending / in-progress / completed).
  - **`ask_user`** — interactive multiple-choice clarifying questions that pause the loop.
  - **`spawn_subagent`** — delegate self-contained sub-tasks to fresh-context sub-agents
    (general / explorer / reviewer), run **in parallel**, returning only their summaries.
  - **`use_skill`** — load skills on demand (progressive disclosure).
  - **`remember`** / **`task_complete`** — durable memory + goal completion.
- **Skills** — built-in + custom instruction bundles; only their name/description sit in
  the prompt until invoked.
- **MCP** — connect Streamable-HTTP MCP servers; their tools are namespaced
  `mcp__server__tool` and offered to the model.
- **Approval modes** (Suggest / Auto Edit / Full Auto), plus **Goal mode (Ralph loop)** —
  autonomous iteration toward a fixed objective until `task_complete` or an iteration cap.
- **Reasoning effort** selector (minimal → high), forwarded as `reasoning_effort`.
- **Sessions** — Codex-style rollouts persisted locally; list, resume, and delete them.
- **Usage visualization** — live token counts, **context-cache hit rate**, context-window
  usage, and estimated cost (DeepSeek's cache hits are ~98% cheaper, so the stable prompt
  prefix is engineered to maximize them).
- **Personal settings & memory** — custom system prompt, persistent memory, theme
  (light / dark / system), all persisted in the browser.
- **Rich tool rendering** — unified **diffs**, a **terminal** view, plan checklists,
  question cards, and nested sub-agent timelines.
- **Workspace file tree** with auto-refresh on mutation, plus a syntax-highlighted **file viewer**.

## Architecture

```
app/
  page.tsx            UI shell (chat + sidebar + file viewer + settings/usage)
  api/
    chat/route.ts     POST → streams one assistant turn as NDJSON (builds prompt + tool list)
    tool/route.ts     POST → executes a single server/MCP tool in the sandbox
    mcp/route.ts      POST → discovers tools from configured MCP servers
    files/route.ts    GET  → workspace file tree
    file/route.ts     GET  → one file's contents
hooks/
  useAgent.ts         the client-side agent loop (the brain): stream → route → execute → repeat;
                      owns settings, sessions, usage, plan, sub-agents, goal mode
lib/
  deepseek.ts         DeepSeek streaming client (reasoning_effort, usage capture, cache-friendly)
  stream-client.ts    shared NDJSON stream reader (main loop + sub-agents)
  tools.ts            core + client tool schemas; sandboxed executors; MCP routing
  mcp.ts              minimal Streamable-HTTP MCP client (JSON-RPC, no SDK dependency)
  skills.ts           built-in skills + sub-agent profiles
  storage.ts          localStorage persistence (settings, memory, session rollouts)
  workspace.ts        path-jail helpers (everything stays inside AGENT_WORKSPACE)
  prompt.ts           deterministic system-prompt builder (stable prefix for cache hits)
  types.ts            shared contracts (wire format, UI model, usage, settings, sessions)
components/           presentational UI (chat, tools, files, layout, controls, settings,
                      sessions, usage, brand)
```

The server is **stateless**: `/api/chat` returns a single assistant turn and never
executes tools; the client (`useAgent`) orchestrates the read→think→act loop, routes
each tool call (server tools → `/api/tool`, client tools handled in-loop), and persists
durable state (settings, memory, sessions) to the browser. Because the server rebuilds a
**deterministic** system prompt + tool list each turn, DeepSeek's automatic prefix cache
stays warm across the loop.

## Getting started

```bash
npm install
npm run dev
# open http://localhost:3000
```

### Configuration (`.env.local`)

```bash
DEEPSEEK_API_KEY=sk-...                       # your DeepSeek API key
DEEPSEEK_BASE_URL=https://api.deepseek.com    # OpenAI-compatible endpoint
DEEPSEEK_DEFAULT_MODEL=deepseek-chat
AGENT_WORKSPACE=/abs/path/to/workspace        # the sandbox the agent operates in
```

The agent can only touch files inside `AGENT_WORKSPACE`; `..` / absolute-path
escapes are blocked. A small demo project is seeded in `workspace/`.

## Notes

- Built with Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, TypeScript.
- DeepSeek's API is OpenAI-compatible, so the same client pattern works for any
  OpenAI-style endpoint by changing `DEEPSEEK_BASE_URL`.
