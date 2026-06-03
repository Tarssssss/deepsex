# DeepSeek Codex — agent context

A Codex-style AI coding agent web app, powered by the **DeepSeek API** and branded
in DeepSeek's design language (brand blue `#4D6BFE`, light + dark themes). It reads,
writes, edits, and runs code inside a sandboxed workspace via a streaming agent loop
with tool calling. See `README.md` for the user-facing overview.

## How to run

```bash
npm install
cp .env.example .env.local   # then set DEEPSEEK_API_KEY
npm run dev                  # http://localhost:3000
```

Required env (see `.env.example`): `DEEPSEEK_API_KEY`. Optional: `DEEPSEEK_BASE_URL`
(default `https://api.deepseek.com`), `DEEPSEEK_DEFAULT_MODEL` (default `deepseek-chat`),
`AGENT_WORKSPACE` (default `./workspace`). The agent can only touch files inside
`AGENT_WORKSPACE`; `..`/absolute-path escapes are blocked.

Note: `deepseek-chat` is a stable alias — DeepSeek routes it to their latest model
(currently **DeepSeek V4 Flash**, non-thinking). `deepseek-reasoner` is the same V4
generation with thinking enabled (shows CoT). V4 has a 1M-token context window, supports
tool calling in thinking mode, and honors `reasoning_effort`. Two V4 gotchas the code
handles: (1) streaming `usage` arrives in a final chunk with an empty `choices` array
(`stream_options.include_usage`); (2) in a tool-calling thinking conversation, every
assistant tool-call message must carry `reasoning_content` back or the API 400s — so the
loop preserves it on the wire.

## Architecture (the one thing to understand first)

The **server is stateless**; the **client drives the loop**. Durable state (settings,
memory, sessions) lives in the browser (`lib/storage.ts`).

- `hooks/useAgent.ts` — the brain. Streams a turn, then **routes** each proposed tool:
  server tools (file/command/MCP) → `/api/tool` gated by the approval policy; client
  tools (plan/ask_user/sub-agent/skill/remember/complete) handled in-loop. Owns settings,
  sessions, usage accounting, the live plan, parallel sub-agents, and goal (Ralph) mode.
- `app/api/chat/route.ts` — POST. Builds the deterministic system prompt + tool list from
  the client's config and streams ONE assistant turn as NDJSON. Does **not** execute tools.
- `app/api/tool/route.ts` — POST. Executes ONE server/MCP tool (`executeTool`) in the sandbox.
- `app/api/mcp/route.ts` — POST. Discovers tools from the client's configured MCP servers.
- `app/api/files` + `app/api/file` — workspace tree + single-file read (for the UI).
- `lib/deepseek.ts` — DeepSeek streaming client. Assembles fragmented tool-call deltas by
  index, forwards `reasoning_effort`, sets temperature 0 + `parallel_tool_calls`, and
  captures the final `usage` chunk → `{type:"usage"}` StreamEvent.
- `lib/stream-client.ts` — shared client NDJSON reader (main loop + sub-agent runs).
- `lib/tools.ts` — core tools (`read_file`, `write_file`, `edit_file`, `list_files`,
  `run_command`) + `CLIENT_TOOL_SCHEMAS` (update_plan, ask_user, spawn_subagent, use_skill,
  remember, task_complete). `executeTool` runs server tools + routes `mcp__*` to `lib/mcp.ts`.
  `edit_file` uses index-based splice (not `String.replace`) so `$` stays literal.
- `lib/mcp.ts` — minimal Streamable-HTTP MCP client (JSON-RPC, no SDK). Tools namespaced
  `mcp__<server>__<tool>`.
- `lib/skills.ts` — built-in skills (progressive disclosure) + sub-agent profiles.
- `lib/storage.ts` — localStorage for settings/memory + Codex-style session rollouts.
- `lib/workspace.ts` — the path jail. Everything resolves through here.
- `lib/types.ts` — the **single source of truth** for shared contracts (wire format, UI
  model, streaming protocol, models+pricing, approval/effort modes, usage, settings,
  sessions, plan/question/sub-agent/skill/MCP shapes). Both server and client import it.
- `lib/prompt.ts` — deterministic system-prompt builder. Sections are emitted in a FIXED
  order to form a stable prefix so DeepSeek's automatic cache stays warm. Never inject
  volatile data (timestamps, random ids) here.
- `components/` — presentational, props-driven UI (chat, tools, files, layout, controls,
  settings, sessions, usage, brand).

## Conventions

- Approval modes mirror Codex: `suggest` (approve all) / `auto-edit` (file ops auto,
  commands + MCP need approval) / `full-auto`. The gate lives in `useAgent.ts`
  (`toolNeedsApproval`), surfaced per-tool via `awaitingApprovalIds`. Goal mode and client
  tools bypass the gate.
- Tools split into **server** tools (executed via `/api/tool`) and **client** tools
  (`CLIENT_TOOLS` in `types.ts`, orchestrated in `useAgent`). Both are advertised to the
  model from the server so they sit in the stable cached tool prefix.
- **Cache discipline**: keep the system prompt + tool schemas + memory a stable,
  append-only prefix. Don't reorder messages or inject per-turn dynamic strings into it.
- Client components need the `"use client"` directive. Presentational components are
  pure (data in, callbacks out); state lives in `useAgent` and `app/page.tsx`.
- Styling uses themeable design tokens defined in `app/globals.css` (Tailwind v4
  `@theme`): e.g. `bg-surface`, `text-muted`, `border-border`, `bg-brand`, plus
  `.ds-card` / `.ds-btn` primitives. Never hardcode one-theme-only hex colors.
- Theme (`light`/`dark`/`system`) is owned by settings; the pre-paint init script in
  `app/layout.tsx` reads it from the `ds-settings` localStorage key.

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This is Next.js 16 with breaking changes — APIs, conventions, and file structure may
differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/`
before writing Next-specific code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
