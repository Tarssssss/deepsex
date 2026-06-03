# DeepSex — agent context

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
(currently **DeepSeek V4 Flash**). `deepseek-reasoner` is the reasoning model (shows CoT).

## Architecture (the one thing to understand first)

The **server is stateless**; the **client drives the loop**.

- `hooks/useAgent.ts` — the brain. The client read→think→act loop: stream a turn,
  gate each proposed tool on the approval policy, execute approved tools, repeat.
- `app/api/chat/route.ts` — POST. Streams ONE assistant turn as NDJSON
  (`StreamEvent` per line). It does **not** execute tools.
- `app/api/tool/route.ts` — POST. Executes ONE tool (`executeTool`) in the sandbox.
- `app/api/files` + `app/api/file` — workspace tree + single-file read (for the UI).
- `lib/deepseek.ts` — DeepSeek streaming client (SSE → `StreamEvent`s, assembles
  fragmented tool-call argument deltas by index).
- `lib/tools.ts` — the 5 tools (`read_file`, `write_file`, `edit_file`, `list_files`,
  `run_command`): OpenAI function schemas + sandboxed executors (unified diffs,
  command capture). `edit_file` uses index-based splice (not `String.replace`) so
  `$` in the replacement stays literal.
- `lib/workspace.ts` — the path jail. Everything resolves through here.
- `lib/types.ts` — the **single source of truth** for shared contracts (wire format,
  UI model, streaming protocol, models, approval modes). Both server and client import it.
- `lib/prompt.ts` — the system prompt that makes DeepSeek behave like Codex.
- `components/` — presentational, props-driven UI (chat, tools, files, layout, brand, controls).

## Conventions

- Approval modes mirror Codex: `suggest` (approve all) / `auto-edit` (file ops auto,
  commands need approval) / `full-auto`. The gate lives in `useAgent.ts`
  (`toolNeedsApproval`), surfaced per-tool via `awaitingApprovalIds`.
- Client components need the `"use client"` directive. Presentational components are
  pure (data in, callbacks out); state lives in `useAgent` and `app/page.tsx`.
- Styling uses themeable design tokens defined in `app/globals.css` (Tailwind v4
  `@theme`): e.g. `bg-surface`, `text-muted`, `border-border`, `bg-brand`, plus
  `.ds-card` / `.ds-btn` primitives. Never hardcode one-theme-only hex colors.

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This is Next.js 16 with breaking changes — APIs, conventions, and file structure may
differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/`
before writing Next-specific code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
