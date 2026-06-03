"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Plus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ThemeToggle } from "@/components/controls/ThemeToggle";
import { AgentRail } from "@/components/agents/AgentRail";
import { AgentChat } from "@/components/agents/AgentChat";
import { AgentEditorPanel } from "@/components/agents/AgentEditorPanel";
import { useCustomAgents, newAgentDraft } from "@/hooks/useCustomAgents";
import { useTheme } from "@/lib/theme";
import type { CustomAgent } from "@/lib/types";

interface EditorState {
  open: boolean;
  agent: CustomAgent | null;
  isNew: boolean;
}

export default function AgentsPage() {
  const {
    agents,
    activeAgent,
    activeId,
    setActive,
    messages,
    status,
    busy,
    error,
    createAgent,
    updateAgent,
    removeAgent,
    send,
    stop,
    newConversation,
  } = useCustomAgents();
  const { theme, setTheme } = useTheme();

  const [editor, setEditor] = useState<EditorState>({
    open: false,
    agent: null,
    isNew: false,
  });

  const openNew = () => setEditor({ open: true, agent: newAgentDraft(), isNew: true });
  const openEdit = (id: string) => {
    const a = agents.find((x) => x.id === id);
    if (a) setEditor({ open: true, agent: a, isNew: false });
  };
  const closeEditor = () => setEditor({ open: false, agent: null, isNew: false });

  const handleSave = (agent: CustomAgent) => {
    if (editor.isNew) createAgent(agent);
    else updateAgent(agent);
    closeEditor();
  };

  return (
    <div className="flex h-screen w-full flex-col bg-bg text-text">
      <Header
        right={
          <div className="flex items-center gap-2">
            <Link href="/" className="ds-btn ds-btn-ghost ds-focus gap-1.5" title="Back to Codex">
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Codex</span>
            </Link>
            <ThemeToggle value={theme} onChange={setTheme} />
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        <AgentRail
          agents={agents}
          activeId={activeId}
          onSelect={setActive}
          onNew={openNew}
          onEdit={openEdit}
          onDelete={removeAgent}
        />

        {activeAgent ? (
          <AgentChat
            agent={activeAgent}
            messages={messages}
            busy={busy}
            status={status}
            onSend={send}
            onStop={stop}
            onEdit={() => openEdit(activeAgent.id)}
            onNewConversation={newConversation}
          />
        ) : (
          <main className="flex min-w-0 flex-1 items-center justify-center p-6">
            <div className="ds-card ds-fade-up max-w-md p-8 text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[12px] bg-brand-soft">
                <Bot size={24} className="text-brand" />
              </div>
              <h2 className="text-base font-semibold text-text">No custom agents yet</h2>
              <p className="mt-1.5 text-sm text-muted">
                Create an agent with its own provider, model, and system prompt — then chat
                with it here.
              </p>
              <button className="ds-btn ds-btn-primary ds-focus mx-auto mt-5" onClick={openNew}>
                <Plus size={15} /> Create your first agent
              </button>
            </div>
          </main>
        )}

        {editor.open && editor.agent && (
          <AgentEditorPanel
            initial={editor.agent}
            isNew={editor.isNew}
            onClose={closeEditor}
            onSave={handleSave}
            onDelete={
              editor.isNew
                ? undefined
                : () => {
                    removeAgent(editor.agent!.id);
                    closeEditor();
                  }
            }
          />
        )}
      </div>

      {error && (
        <div className="mx-auto mb-3 w-full max-w-3xl shrink-0 rounded-[10px] border border-[color:var(--error)] bg-[color:var(--error-soft)] px-4 py-2 text-sm text-error">
          {error}
        </div>
      )}
    </div>
  );
}
