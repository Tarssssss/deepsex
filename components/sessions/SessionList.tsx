"use client";

import { MessageSquare, Trash2, Plus } from "lucide-react";
import type { SessionMeta } from "@/lib/types";

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Codex-style session ("rollout") picker. */
export function SessionList({
  sessions,
  currentId,
  onSelect,
  onNew,
  onDelete,
}: {
  sessions: SessionMeta[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
          Sessions
        </span>
        <button
          type="button"
          onClick={onNew}
          className="ds-btn ds-btn-ghost ds-focus h-6 w-6 p-0"
          title="New session"
          aria-label="New session"
        >
          <Plus size={14} className="text-muted" />
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="px-1 py-3 text-center text-xs text-faint">No saved sessions</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {sessions.map((s) => {
            const active = s.id === currentId;
            return (
              <li key={s.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className={`ds-focus flex w-full items-start gap-2 rounded-[8px] px-2 py-1.5 text-left transition-colors ${
                    active ? "bg-brand-soft" : "hover:bg-surface-2"
                  }`}
                >
                  <MessageSquare
                    size={14}
                    className={`mt-0.5 shrink-0 ${active ? "text-brand" : "text-faint"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-text">
                      {s.title}
                    </span>
                    <span className="block text-[10px] text-faint">
                      {relativeTime(s.updatedAt)} · {s.messageCount} msgs
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                  className="ds-focus absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-[6px] text-faint hover:bg-surface-3 hover:text-error group-hover:flex"
                  title="Delete session"
                  aria-label="Delete session"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
