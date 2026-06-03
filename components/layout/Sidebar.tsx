"use client";

import { RefreshCw } from "lucide-react";
import { FileTree } from "@/components/files/FileTree";
import type { FileNode } from "@/lib/types";

interface SidebarProps {
  tree: FileNode[];
  selectedPath: string | null;
  onSelect: (p: string) => void;
  onRefresh?: () => void;
  root?: string;
}

/** Basename of a path, tolerant of trailing slashes and empty input. */
function basename(p: string): string {
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

export function Sidebar({
  tree,
  selectedPath,
  onSelect,
  onRefresh,
  root,
}: SidebarProps) {
  const rootName = root ? basename(root) : null;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-bg-subtle">
      <div className="shrink-0 px-3 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Workspace
          </span>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="ds-btn ds-btn-ghost ds-focus h-7 w-7 p-0"
              aria-label="Refresh file tree"
              title="Refresh files"
            >
              <RefreshCw size={14} className="text-muted" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {rootName ? (
          <p className="mt-0.5 truncate text-xs text-faint" title={root}>
            {rootName}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {tree.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-faint">
            Empty workspace
          </p>
        ) : (
          <FileTree
            nodes={tree}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        )}
      </div>
    </aside>
  );
}
