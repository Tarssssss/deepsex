"use client";

import { useState } from "react";
import {
  X,
  Eye,
  EyeOff,
  Lock,
  PlugZap,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { ACCENT_SWATCHES, type CustomAgent } from "@/lib/types";
import { AgentAvatar } from "./AgentAvatar";

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; latencyMs?: number }
  | { kind: "error"; message: string };

/** Right-side panel to create/edit a custom agent. */
export function AgentEditorPanel({
  initial,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  initial: CustomAgent;
  isNew: boolean;
  onClose: () => void;
  onSave: (agent: CustomAgent) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<CustomAgent>(initial);
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  const set = <K extends keyof CustomAgent>(key: K, value: CustomAgent[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const urlValid = /^https?:\/\//.test(draft.baseUrl.trim());
  const valid = !!draft.name.trim() && urlValid && !!draft.model.trim();

  async function runTest() {
    setTest({ kind: "testing" });
    try {
      const r = await fetch("/api/agents/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: draft.baseUrl, apiKey: draft.apiKey }),
      });
      const d = await r.json();
      if (d.ok) setTest({ kind: "ok", latencyMs: d.latencyMs });
      else setTest({ kind: "error", message: d.message || "Connection failed." });
    } catch (e) {
      setTest({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <aside className="ds-fade-up flex w-[42%] min-w-0 max-w-xl shrink-0 flex-col border-l border-border bg-surface">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-medium text-text">
          {isNew ? "New agent" : "Edit agent"}
        </span>
        <button className="ds-btn ds-btn-ghost ds-focus !p-1.5" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* Identity */}
        <Field label="Identity">
          <div className="flex items-center gap-3">
            <AgentAvatar agent={draft} size={40} />
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={40}
              placeholder="e.g. Rust Reviewer"
              className={inputCls}
            />
          </div>
        </Field>

        <Field label="Description" hint="Shown under the name in the switcher.">
          <input
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={120}
            placeholder="Short tagline"
            className={inputCls}
          />
        </Field>

        <Field label="Accent">
          <div className="flex flex-wrap gap-2">
            {ACCENT_SWATCHES.map((c) => {
              const on = draft.accent === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("accent", c)}
                  aria-label={`Accent ${c}`}
                  className={`ds-focus h-7 w-7 rounded-[8px] transition-transform ${
                    on ? "" : "hover:scale-105"
                  }`}
                  style={{
                    background: c,
                    boxShadow: on ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : undefined,
                  }}
                />
              );
            })}
          </div>
        </Field>

        <Field label="Provider base URL" hint="OpenAI-compatible endpoint.">
          <input
            value={draft.baseUrl}
            onChange={(e) => set("baseUrl", e.target.value)}
            placeholder="https://api.openai.com/v1"
            className={`${inputCls} font-mono text-xs`}
          />
          {draft.baseUrl && !urlValid && (
            <p className="mt-1 text-xs text-error">Must start with http:// or https://</p>
          )}
        </Field>

        <Field label="API key" hint="Stored locally in your browser, sent only to your provider.">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={draft.apiKey}
              onChange={(e) => set("apiKey", e.target.value)}
              placeholder="sk-…"
              className={`${inputCls} pr-10 font-mono text-xs`}
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
          <p className="mt-1 flex items-center gap-1.5 text-xs text-faint">
            <Lock size={12} /> Never leaves your machine except to the provider.
          </p>
        </Field>

        <Field label="Model" hint="Model id exactly as the provider expects.">
          <input
            value={draft.model}
            onChange={(e) => set("model", e.target.value)}
            placeholder="gpt-4o-mini"
            className={`${inputCls} font-mono text-xs`}
          />
        </Field>

        {/* Test connection */}
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={runTest}
            disabled={!urlValid || test.kind === "testing"}
            className="ds-btn ds-focus gap-1.5"
          >
            {test.kind === "testing" ? (
              <Loader2 size={14} className="ds-spin" />
            ) : (
              <PlugZap size={14} />
            )}
            Test connection
          </button>
          {test.kind === "ok" && (
            <span className="flex items-center gap-1 text-xs text-success">
              <Check size={14} /> Connected{test.latencyMs ? ` · ${test.latencyMs}ms` : ""}
            </span>
          )}
          {test.kind === "error" && (
            <span className="flex items-center gap-1 text-xs text-error">
              <AlertCircle size={14} /> {test.message}
            </span>
          )}
        </div>

        <Field label="System prompt" hint="Sets this agent's persona. Optional.">
          <textarea
            value={draft.systemPrompt}
            onChange={(e) => set("systemPrompt", e.target.value)}
            rows={8}
            placeholder="You are a meticulous senior engineer who…"
            className={`${inputCls} resize-y font-mono text-xs`}
          />
        </Field>

        <Field label={`Temperature: ${draft.temperature.toFixed(1)}`}>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={draft.temperature}
            onChange={(e) => set("temperature", Number(e.target.value))}
            className="w-full accent-[color:var(--brand)]"
          />
          <div className="flex justify-between text-[11px] text-faint">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </Field>

        {!draft.apiKey.trim() && (
          <p className="text-xs text-warning">No API key set — requests will likely fail.</p>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
        {!isNew && onDelete ? (
          <button type="button" className="ds-btn ds-btn-ghost text-error" onClick={onDelete}>
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" className="ds-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ds-btn ds-btn-primary"
            disabled={!valid}
            onClick={() => onSave(draft)}
          >
            Save agent
          </button>
        </div>
      </footer>
    </aside>
  );
}

const inputCls =
  "ds-focus w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <label className="mb-1.5 block text-sm font-medium text-text">{label}</label>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}
