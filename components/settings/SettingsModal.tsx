"use client";

import { useState } from "react";
import {
  X,
  Sliders,
  FileText,
  Brain,
  Sparkles,
  Bot,
  Plug,
  Target,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  REASONING_EFFORTS,
  MODELS,
  APPROVAL_MODES,
  type AgentSettings,
  type McpServerConfig,
  type Skill,
  type McpToolInfo,
  type ThemePref,
} from "@/lib/types";
import { BUILTIN_SKILLS, BUILTIN_AGENTS } from "@/lib/skills";

type Tab =
  | "general"
  | "prompt"
  | "memory"
  | "skills"
  | "agents"
  | "mcp"
  | "goal";

const TABS: { id: Tab; label: string; icon: typeof Sliders }[] = [
  { id: "general", label: "General", icon: Sliders },
  { id: "prompt", label: "System prompt", icon: FileText },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "agents", label: "Sub-agents", icon: Bot },
  { id: "mcp", label: "MCP", icon: Plug },
  { id: "goal", label: "Goal mode", icon: Target },
];

export function SettingsModal({
  settings,
  update,
  mcpTools,
  onClose,
}: {
  settings: AgentSettings;
  update: (patch: Partial<AgentSettings>) => void;
  mcpTools: McpToolInfo[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[color:var(--overlay)]" onClick={onClose} />
      <div className="ds-card ds-fade-up relative z-10 flex h-[80vh] max-h-[640px] w-full max-w-3xl overflow-hidden p-0">
        {/* Tab nav */}
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border bg-bg-subtle p-2">
          <div className="px-2 pb-2 pt-1 text-sm font-semibold text-text">Settings</div>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`ds-focus flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors ${
                  active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2"
                }`}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
            <span className="text-sm font-medium text-text">
              {TABS.find((t) => t.id === tab)?.label}
            </span>
            <button className="ds-btn ds-btn-ghost ds-focus !p-1.5" onClick={onClose} aria-label="Close settings">
              <X size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "general" && <GeneralTab settings={settings} update={update} />}
            {tab === "prompt" && <PromptTab settings={settings} update={update} />}
            {tab === "memory" && <MemoryTab settings={settings} update={update} />}
            {tab === "skills" && <SkillsTab settings={settings} update={update} />}
            {tab === "agents" && <AgentsTab />}
            {tab === "mcp" && (
              <McpTab settings={settings} update={update} mcpTools={mcpTools} />
            )}
            {tab === "goal" && <GoalTab settings={settings} update={update} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- tabs ----------------------------- */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="mb-1.5 block text-sm font-medium text-text">{label}</label>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}

function GeneralTab({
  settings,
  update,
}: {
  settings: AgentSettings;
  update: (p: Partial<AgentSettings>) => void;
}) {
  const themes: ThemePref[] = ["light", "dark", "system"];
  const [showKey, setShowKey] = useState(false);
  return (
    <div>
      <Field
        label="DeepSeek API key"
        hint="Stored locally in your browser. Lets you start without editing .env — leave empty to use the server's DEEPSEEK_API_KEY."
      >
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={settings.deepseekApiKey}
            onChange={(e) => update({ deepseekApiKey: e.target.value })}
            placeholder="sk-…"
            className="ds-focus w-full rounded-[8px] border border-border bg-surface px-3 py-2 pr-10 font-mono text-xs text-text placeholder:text-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="ds-btn ds-btn-ghost ds-focus !absolute !right-1 !top-1/2 !-translate-y-1/2 !p-1.5"
            aria-label={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </Field>

      <Field label="Theme">
        <div className="flex gap-1.5">
          {themes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update({ theme: t })}
              className={`ds-focus flex-1 rounded-[8px] border px-3 py-2 text-sm capitalize transition-colors ${
                settings.theme === t
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border text-muted hover:border-border-strong"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Model">
        <div className="flex flex-col gap-1.5">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => update({ model: m.id })}
              className={`ds-focus rounded-[8px] border px-3 py-2 text-left transition-colors ${
                settings.model === m.id
                  ? "border-brand bg-brand-soft"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <span className="block text-sm font-medium text-text">{m.label}</span>
              <span className="block text-xs text-muted">{m.description}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Reasoning effort">
        <div className="flex gap-1.5">
          {REASONING_EFFORTS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => update({ reasoningEffort: e.id })}
              title={e.description}
              className={`ds-focus flex-1 rounded-[8px] border px-2 py-2 text-xs transition-colors ${
                settings.reasoningEffort === e.id
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border text-muted hover:border-border-strong"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Approval mode" hint="When the agent must ask before acting.">
        <div className="flex flex-col gap-1.5">
          {APPROVAL_MODES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => update({ approvalMode: a.id })}
              className={`ds-focus rounded-[8px] border px-3 py-2 text-left transition-colors ${
                settings.approvalMode === a.id
                  ? "border-brand bg-brand-soft"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <span className="block text-sm font-medium text-text">{a.label}</span>
              <span className="block text-xs text-muted">{a.description}</span>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function PromptTab({
  settings,
  update,
}: {
  settings: AgentSettings;
  update: (p: Partial<AgentSettings>) => void;
}) {
  return (
    <Field
      label="Custom system prompt"
      hint="Override the default DeepSeek Codex persona. Leave empty to use the built-in prompt. Tool docs, skills, memory, and effort guidance are always appended automatically."
    >
      <textarea
        value={settings.systemPromptOverride}
        onChange={(e) => update({ systemPromptOverride: e.target.value })}
        rows={14}
        placeholder="e.g. You are a senior Rust engineer who values minimal, well-tested changes…"
        className="ds-focus w-full resize-y rounded-[8px] border border-border bg-surface px-3 py-2 font-mono text-xs text-text placeholder:text-faint focus:outline-none"
      />
    </Field>
  );
}

function MemoryTab({
  settings,
  update,
}: {
  settings: AgentSettings;
  update: (p: Partial<AgentSettings>) => void;
}) {
  return (
    <Field
      label="Persistent memory"
      hint="Personal preferences and project facts injected into every conversation (AGENTS.md / MEMORY.md style). The agent can also append here via the remember tool."
    >
      <textarea
        value={settings.memory}
        onChange={(e) => update({ memory: e.target.value })}
        rows={14}
        placeholder={"- Prefer TypeScript strict mode\n- Use 2-space indentation\n- Always run the linter before finishing"}
        className="ds-focus w-full resize-y rounded-[8px] border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none"
      />
    </Field>
  );
}

function SkillsTab({
  settings,
  update,
}: {
  settings: AgentSettings;
  update: (p: Partial<AgentSettings>) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [body, setBody] = useState("");

  function toggleDisabled(skillName: string) {
    const disabled = settings.disabledSkills.includes(skillName)
      ? settings.disabledSkills.filter((n) => n !== skillName)
      : [...settings.disabledSkills, skillName];
    update({ disabledSkills: disabled });
  }

  function addSkill() {
    const clean = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean || !desc.trim() || !body.trim()) return;
    const skill: Skill = {
      id: `custom-${Date.now()}`,
      name: clean,
      description: desc.trim(),
      body: body.trim(),
    };
    update({ customSkills: [...settings.customSkills, skill] });
    setName("");
    setDesc("");
    setBody("");
  }

  function removeSkill(id: string) {
    update({ customSkills: settings.customSkills.filter((s) => s.id !== id) });
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Skills are loaded on demand via progressive disclosure — only their name
        and description sit in the prompt until the agent invokes one.
      </p>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
        Built-in
      </div>
      <ul className="mb-5 flex flex-col gap-1.5">
        {BUILTIN_SKILLS.map((s) => {
          const off = settings.disabledSkills.includes(s.name);
          return (
            <li
              key={s.id}
              className="flex items-start gap-2 rounded-[8px] border border-border px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-xs text-text">{s.name}</span>
                <span className="block text-xs text-muted">{s.description}</span>
              </span>
              <button
                type="button"
                onClick={() => toggleDisabled(s.name)}
                className={`ds-focus shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
                  off ? "bg-surface-3 text-muted" : "bg-brand-soft text-brand"
                }`}
              >
                {off ? "Off" : "On"}
              </button>
            </li>
          );
        })}
      </ul>

      {settings.customSkills.length > 0 && (
        <>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
            Custom
          </div>
          <ul className="mb-5 flex flex-col gap-1.5">
            {settings.customSkills.map((s) => (
              <li
                key={s.id}
                className="flex items-start gap-2 rounded-[8px] border border-border px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xs text-text">{s.name}</span>
                  <span className="block text-xs text-muted">{s.description}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeSkill(s.id)}
                  className="ds-focus shrink-0 text-faint hover:text-error"
                  aria-label="Delete skill"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="rounded-[8px] border border-border bg-bg-subtle p-3">
        <div className="mb-2 text-xs font-semibold text-text">Add a skill</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name (e.g. write-docs)"
          className="ds-focus mb-1.5 w-full rounded-[6px] border border-border bg-surface px-2.5 py-1.5 text-xs text-text focus:outline-none"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="description — what it does and when to use it"
          className="ds-focus mb-1.5 w-full rounded-[6px] border border-border bg-surface px-2.5 py-1.5 text-xs text-text focus:outline-none"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="instructions (loaded only when the skill is invoked)"
          className="ds-focus mb-2 w-full resize-y rounded-[6px] border border-border bg-surface px-2.5 py-1.5 text-xs text-text focus:outline-none"
        />
        <button type="button" onClick={addSkill} className="ds-btn ds-btn-primary gap-1.5">
          <Plus size={14} /> Add skill
        </button>
      </div>
    </div>
  );
}

function AgentsTab() {
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Built-in sub-agent profiles. The main agent delegates to these via
        spawn_subagent; each runs in a fresh context and returns only its result.
        Independent delegations run in parallel.
      </p>
      <ul className="flex flex-col gap-1.5">
        {BUILTIN_AGENTS.map((a) => (
          <li key={a.id} className="rounded-[8px] border border-border px-3 py-2">
            <span className="block text-sm font-medium text-text">{a.name}</span>
            <span className="block text-xs text-muted">{a.description}</span>
            {a.tools && (
              <span className="mt-1 block font-mono text-[11px] text-faint">
                tools: {a.tools.join(", ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function McpTab({
  settings,
  update,
  mcpTools,
}: {
  settings: AgentSettings;
  update: (p: Partial<AgentSettings>) => void;
  mcpTools: McpToolInfo[];
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  function addServer() {
    if (!name.trim() || !url.trim()) return;
    const server: McpServerConfig = {
      id: `mcp-${Date.now()}`,
      name: name.trim(),
      url: url.trim(),
      enabled: true,
    };
    update({ mcpServers: [...settings.mcpServers, server] });
    setName("");
    setUrl("");
  }

  function toggle(id: string) {
    update({
      mcpServers: settings.mcpServers.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    });
  }

  function remove(id: string) {
    update({ mcpServers: settings.mcpServers.filter((s) => s.id !== id) });
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Connect Streamable-HTTP MCP servers. Their tools are namespaced
        <span className="font-mono"> mcp__server__tool</span> and offered to the
        model.
      </p>

      {settings.mcpServers.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1.5">
          {settings.mcpServers.map((s) => {
            const count = mcpTools.filter((t) => t.server === s.name).length;
            return (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-[8px] border border-border px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text">{s.name}</span>
                  <span className="block truncate font-mono text-[11px] text-faint">
                    {s.url}
                  </span>
                  {s.enabled && (
                    <span className="text-[11px] text-success">{count} tools</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={`ds-focus shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
                    s.enabled ? "bg-brand-soft text-brand" : "bg-surface-3 text-muted"
                  }`}
                >
                  {s.enabled ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="ds-focus shrink-0 text-faint hover:text-error"
                  aria-label="Remove server"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-[8px] border border-border bg-bg-subtle p-3">
        <div className="mb-2 text-xs font-semibold text-text">Add MCP server</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name (e.g. github)"
          className="ds-focus mb-1.5 w-full rounded-[6px] border border-border bg-surface px-2.5 py-1.5 text-xs text-text focus:outline-none"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/mcp"
          className="ds-focus mb-2 w-full rounded-[6px] border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text focus:outline-none"
        />
        <button type="button" onClick={addServer} className="ds-btn ds-btn-primary gap-1.5">
          <Plus size={14} /> Add server
        </button>
      </div>
    </div>
  );
}

function GoalTab({
  settings,
  update,
}: {
  settings: AgentSettings;
  update: (p: Partial<AgentSettings>) => void;
}) {
  return (
    <div>
      <Field
        label="Goal mode (Ralph loop)"
        hint="Autonomously re-runs toward a fixed goal each iteration, treating the workspace as durable memory, until the agent calls task_complete or the iteration cap is hit. Runs unattended (no approvals) — keep it in a sandbox."
      >
        <button
          type="button"
          onClick={() => update({ goalMode: !settings.goalMode })}
          className={`ds-focus flex w-full items-center justify-between rounded-[8px] border px-3 py-2.5 transition-colors ${
            settings.goalMode ? "border-brand bg-brand-soft" : "border-border"
          }`}
        >
          <span className="text-sm font-medium text-text">
            {settings.goalMode ? "Enabled" : "Disabled"}
          </span>
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${
              settings.goalMode ? "bg-brand" : "bg-surface-3"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                settings.goalMode ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </Field>

      <Field label={`Max iterations: ${settings.goalMaxIterations}`}>
        <input
          type="range"
          min={1}
          max={50}
          value={settings.goalMaxIterations}
          onChange={(e) => update({ goalMaxIterations: Number(e.target.value) })}
          className="w-full accent-[color:var(--brand)]"
        />
      </Field>
    </div>
  );
}
