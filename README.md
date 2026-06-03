# DeepSeek Codex

A Codex-style AI coding agent, powered by the **DeepSeek** API and dressed in
DeepSeek's design language (brand blue `#4D6BFE`, light + dark themes).

It reads, writes, edits, and runs code inside a sandboxed workspace — driven by a
streaming agent loop with tool calling, just like Codex.

![DeepSeek Codex](public/window.svg)

## Features

- **Streaming chat** with `deepseek-chat` (V3) and `deepseek-reasoner` (R1, shows its thinking).
- **Agent tool loop** — the model plans, calls tools, sees the results, and continues until done.
- **Five tools**, all jailed to the workspace sandbox:
  - `read_file`, `write_file`, `edit_file` (exact-match patch), `list_files`, `run_command`.
- **Approval modes** (mirrors Codex):
  - **Suggest** — approve every action.
  - **Auto Edit** — file edits auto-applied; shell commands need approval.
  - **Full Auto** — everything runs automatically.
- **Rich tool rendering** — unified **diffs** for edits, a **terminal** view for commands,
  expandable result cards.
- **Workspace file tree** with auto-refresh on mutation, plus a syntax-highlighted **file viewer**.
- **Markdown** answers with code highlighting, model picker, theme toggle, status bar.

## Architecture

```
app/
  page.tsx            UI shell (chat + sidebar + file viewer)
  api/
    chat/route.ts     POST → streams one assistant turn as NDJSON (no tools executed here)
    tool/route.ts     POST → executes a single tool in the sandbox
    files/route.ts    GET  → workspace file tree
    file/route.ts     GET  → one file's contents
hooks/
  useAgent.ts         the client-side agent loop (the brain): stream → gate → execute → repeat
lib/
  deepseek.ts         DeepSeek streaming client (SSE → StreamEvents, fragmented tool-call assembly)
  tools.ts            tool schemas + sandboxed executors (diffing, command capture)
  workspace.ts        path-jail helpers (everything stays inside AGENT_WORKSPACE)
  prompt.ts           the system prompt that makes DeepSeek behave like Codex
  types.ts            shared contracts (wire format, UI model, streaming protocol)
components/           presentational UI (chat, tools, files, layout, brand, controls)
```

The server is **stateless**: `/api/chat` returns a single assistant turn and never
executes tools; the client (`useAgent`) orchestrates the read→think→act loop and
calls `/api/tool` for each approved action. This keeps approval gating, streaming,
and the tool loop all in one place and makes the backend trivial.

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
