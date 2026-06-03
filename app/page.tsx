"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, PanelRightClose, Settings, Target } from "lucide-react";
import { useAgent } from "@/hooks/useAgent";
import { FileNode } from "@/lib/types";

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { EmptyState } from "@/components/chat/EmptyState";
import { FileViewer } from "@/components/files/FileViewer";
import { ModelSelector } from "@/components/controls/ModelSelector";
import { ApprovalModeSelector } from "@/components/controls/ApprovalModeSelector";
import { EffortSelector } from "@/components/controls/EffortSelector";
import { ThemeToggle } from "@/components/controls/ThemeToggle";
import { PlanView } from "@/components/tools/PlanView";
import { UsagePanel } from "@/components/usage/UsagePanel";
import { SettingsModal } from "@/components/settings/SettingsModal";

const STATUS_LABELS: Record<string, string> = {
  idle: "Ready",
  thinking: "Thinking…",
  streaming: "Responding…",
  "awaiting-approval": "Waiting for approval",
  "awaiting-input": "Waiting for your answer",
  "running-tool": "Running tool…",
  subagent: "Sub-agent working…",
};

export default function Home() {
  const agent = useAgent();
  const {
    messages,
    status,
    busy,
    error,
    plan,
    usage,
    goalIteration,
    settings,
    updateSettings,
    model,
    setModel,
    approvalMode,
    setApprovalMode,
    reasoningEffort,
    setReasoningEffort,
    mcpTools,
    sessions,
    currentSessionId,
    newSession,
    loadSessionById,
    removeSession,
    awaitingApprovalIds,
    pendingQuestionIds,
    workspaceVersion,
    send,
    approve,
    reject,
    answerQuestion,
    stop,
  } = agent;

  const [tree, setTree] = useState<FileNode[]>([]);
  const [root, setRoot] = useState<string>("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUsage, setShowUsage] = useState(false);

  const loadTree = useCallback(async () => {
    try {
      const r = await fetch("/api/files");
      const d = await r.json();
      setTree(d.tree || []);
      setRoot(d.root || "");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTree();
  }, [loadTree, workspaceVersion]);

  useEffect(() => {
    if (!selectedPath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFileContent("");
      return;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFileLoading(true);
    fetch(`/api/file?path=${encodeURIComponent(selectedPath)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setFileContent(d.content ?? d.error ?? "");
      })
      .catch(() => {
        if (!cancelled) setFileContent("");
      })
      .finally(() => {
        if (!cancelled) setFileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPath, workspaceVersion]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen w-full flex-col bg-bg text-text">
      <Header
        right={
          <div className="flex items-center gap-2">
            <ApprovalModeSelector value={approvalMode} onChange={setApprovalMode} />
            <EffortSelector value={reasoningEffort} onChange={setReasoningEffort} />
            <ModelSelector value={model} onChange={setModel} />
            <button
              className={`ds-btn ds-btn-ghost ds-focus !p-2 ${
                settings.goalMode ? "text-brand" : ""
              }`}
              onClick={() => updateSettings({ goalMode: !settings.goalMode })}
              title={settings.goalMode ? "Goal mode on" : "Enable goal mode"}
              aria-label="Toggle goal mode"
            >
              <Target size={16} />
            </button>
            <button
              className="ds-btn ds-btn-ghost ds-focus !p-2"
              onClick={() => setShowSettings(true)}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>
            <button
              className="ds-btn ds-btn-ghost ds-focus"
              onClick={newSession}
              title="New chat"
              aria-label="New chat"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New</span>
            </button>
            <ThemeToggle
              value={settings.theme}
              onChange={(t) => updateSettings({ theme: t })}
            />
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          tree={tree}
          root={root}
          selectedPath={selectedPath}
          onSelect={(p) => setSelectedPath(p)}
          onRefresh={loadTree}
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={loadSessionById}
          onNewSession={newSession}
          onDeleteSession={removeSession}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {error && (
            <div className="mx-auto mt-3 w-full max-w-3xl shrink-0 rounded-[10px] border border-[color:var(--error)] bg-[color:var(--error-soft)] px-4 py-2 text-sm text-error">
              {error}
            </div>
          )}

          {hasMessages ? (
            <MessageList
              messages={messages}
              approvalMode={approvalMode}
              awaitingApprovalIds={awaitingApprovalIds}
              pendingQuestionIds={pendingQuestionIds}
              onApprove={approve}
              onReject={reject}
              onAnswer={answerQuestion}
              busy={busy}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
              <EmptyState onPick={(p) => send(p)} />
            </div>
          )}

          <div className="shrink-0 px-4 pb-4">
            <div className="mx-auto w-full max-w-3xl">
              {plan.length > 0 && (
                <div className="mb-2 rounded-[10px] border border-border bg-surface px-3 py-2">
                  <PlanView steps={plan} />
                </div>
              )}
              <Composer onSend={send} busy={busy} onStop={stop} />
            </div>
          </div>
        </main>

        {selectedPath && (
          <aside className="flex w-[40%] min-w-0 max-w-xl flex-col border-l border-border bg-bg-subtle">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
              <span className="truncate font-mono text-xs text-muted">
                {selectedPath}
              </span>
              <button
                className="ds-btn ds-btn-ghost ds-focus !p-1.5"
                onClick={() => setSelectedPath(null)}
                title="Close"
                aria-label="Close file viewer"
              >
                <PanelRightClose size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <FileViewer
                path={selectedPath}
                content={fileContent}
                loading={fileLoading}
              />
            </div>
          </aside>
        )}
      </div>

      <StatusBar
        status={STATUS_LABELS[status] ?? status}
        model={model}
        approvalMode={approvalMode}
        reasoningEffort={reasoningEffort}
        usage={usage}
        goalMode={settings.goalMode}
        goalIteration={goalIteration}
        onShowUsage={() => setShowUsage(true)}
      />

      {showSettings && (
        <SettingsModal
          settings={settings}
          update={updateSettings}
          mcpTools={mcpTools}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showUsage && (
        <UsagePanel usage={usage} model={model} onClose={() => setShowUsage(false)} />
      )}
    </div>
  );
}
