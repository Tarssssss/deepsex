"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { CustomAgent } from "@/lib/types";
import { AgentAvatar } from "./AgentAvatar";

/** Left rail: the ccswitch-style agent switcher (list + create/edit/delete). */
export function AgentRail({
  agents,
  activeId,
  onSelect,
  onNew,
  onEdit,
  onDelete,
}: {
  agents: CustomAgent[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-bg-subtle">
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <span className="text-sm font-semibold text-text">Agents</span>
        <button
          type="button"
          onClick={onNew}
          className="ds-btn ds-btn-primary ds-focus !px-2.5 !py-1.5 text-xs"
        >
          <Plus size={15} /> New
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {agents.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-faint">
            Create an agent to get started
          </p>
        ) : (
          agents.map((a) => (
            <AgentRailItem
              key={a.id}
              agent={a}
              active={a.id === activeId}
              onSelect={() => onSelect(a.id)}
              onEdit={() => onEdit(a.id)}
              onDelete={() => onDelete(a.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function AgentRailItem({
  agent,
  active,
  onSelect,
  onEdit,
  onDelete,
}: {
  agent: CustomAgent;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="group relative">
      {active && (
        <span
          className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-full"
          style={{ background: agent.accent }}
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        onClick={onSelect}
        className={`ds-focus flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors ${
          active ? "bg-brand-soft" : "hover:bg-surface-2"
        }`}
      >
        <AgentAvatar agent={agent} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">
            {agent.name || "Untitled agent"}
          </span>
          <span className="block truncate text-xs text-muted">
            {agent.model || "no model"}
          </span>
        </span>
      </button>

      {confirming ? (
        <span className="absolute right-1.5 top-1.5 flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onDelete();
              setConfirming(false);
            }}
            className="ds-focus rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium text-error hover:bg-surface-3"
          >
            Delete?
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="ds-focus rounded-[6px] px-1.5 py-0.5 text-[11px] text-muted hover:bg-surface-3"
          >
            Cancel
          </button>
        </span>
      ) : (
        <span className="absolute right-1.5 top-1.5 hidden items-center gap-0.5 group-hover:flex">
          <button
            type="button"
            onClick={onEdit}
            className="ds-focus rounded-[6px] p-1 text-faint hover:bg-surface-3 hover:text-text"
            aria-label="Edit agent"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="ds-focus rounded-[6px] p-1 text-faint hover:bg-surface-3 hover:text-error"
            aria-label="Delete agent"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </span>
      )}
    </div>
  );
}
