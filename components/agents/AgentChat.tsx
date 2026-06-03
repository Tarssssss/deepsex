"use client";

import { useEffect, useRef } from "react";
import { Settings, Plus } from "lucide-react";
import type { CustomAgent, CustomAgentMessage } from "@/lib/types";
import { Composer } from "@/components/chat/Composer";
import { Markdown } from "@/components/chat/Markdown";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { AgentAvatar } from "./AgentAvatar";

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** The conversation pane for the active custom agent. */
export function AgentChat({
  agent,
  messages,
  busy,
  status,
  onSend,
  onStop,
  onEdit,
  onNewConversation,
}: {
  agent: CustomAgent;
  messages: CustomAgentMessage[];
  busy: boolean;
  status: string;
  onSend: (text: string) => void;
  onStop: () => void;
  onEdit: () => void;
  onNewConversation: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, last?.content, last?.streaming]);

  const waiting = busy && last?.role === "user";

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <AgentAvatar agent={agent} size={26} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-text">{agent.name}</div>
            <div className="truncate text-xs text-muted">
              {agent.model} · {hostOf(agent.baseUrl)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="ds-btn ds-btn-ghost ds-focus !p-2"
            onClick={onEdit}
            title="Edit agent"
            aria-label="Edit agent"
          >
            <Settings size={15} />
          </button>
          <button
            className="ds-btn ds-btn-ghost ds-focus"
            onClick={onNewConversation}
            title="New conversation"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">New chat</span>
          </button>
        </div>
      </header>

      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <AgentAvatar agent={agent} size={48} />
          <h2 className="mt-3 text-base font-semibold text-text">{agent.name}</h2>
          {agent.description && (
            <p className="mt-1 max-w-sm text-sm text-muted">{agent.description}</p>
          )}
          <p className="mt-1 text-xs text-faint">
            {agent.model} · temp {agent.temperature}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
            {messages.map((m) => (
              <AgentBubble key={m.id} message={m} agent={agent} />
            ))}
            {waiting && (
              <div className="flex gap-3">
                <span className="h-7 w-7 shrink-0" aria-hidden />
                <ThinkingIndicator label={`${agent.name} is thinking`} />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <div className="shrink-0 px-4 pb-4">
        <div className="mx-auto w-full max-w-3xl">
          <Composer onSend={onSend} busy={busy} onStop={onStop} />
          {status && status !== "idle" && (
            <p className="mt-1.5 px-1 text-center text-xs text-faint capitalize">{status}…</p>
          )}
        </div>
      </div>
    </main>
  );
}

function AgentBubble({
  message,
  agent,
}: {
  message: CustomAgentMessage;
  agent: CustomAgent;
}) {
  if (message.role === "user") {
    return (
      <div className="ds-fade-up flex justify-end">
        <div className="max-w-[80%] rounded-[var(--radius-lg)] bg-brand px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-[var(--brand-contrast)] shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  const empty = message.content.trim().length === 0;

  return (
    <div className="ds-fade-up flex gap-3">
      <span className="mt-0.5 shrink-0">
        <AgentAvatar agent={agent} size={28} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {message.error ? (
          <div className="rounded-[var(--radius-lg)] border border-[color:var(--error)] bg-[color:var(--error-soft)] px-4 py-2.5 text-sm text-error">
            {message.content || "Something went wrong."}
          </div>
        ) : empty && message.streaming ? (
          <span className="ds-cursor text-text" />
        ) : (
          <>
            <Markdown>{message.content}</Markdown>
            {message.streaming && <span className="ds-cursor" />}
          </>
        )}
      </div>
    </div>
  );
}
