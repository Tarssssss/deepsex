"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X,
  Folder,
  FolderOpen,
  CornerLeftUp,
  Home,
  Loader2,
  Check,
} from "lucide-react";
import type { BrowseResponse } from "@/lib/types";

/**
 * Folder picker (opencode-style "open a folder"). Browses the local machine's
 * directories via /api/browse and lets the user choose one as the agent's
 * active workspace root.
 */
export function FolderPicker({
  current,
  onClose,
  onOpen,
}: {
  current: string;
  onClose: () => void;
  onOpen: (path: string) => void;
}) {
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const browse = useCallback(async (path?: string | null) => {
    setLoading(true);
    try {
      const url = path ? `/api/browse?path=${encodeURIComponent(path)}` : "/api/browse";
      const r = await fetch(url);
      const d = (await r.json()) as BrowseResponse;
      setData(d);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    browse(current || null);
  }, [browse, current]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[color:var(--overlay)]" onClick={onClose} />
      <div className="ds-card ds-fade-up relative z-10 flex h-[70vh] max-h-[560px] w-full max-w-lg flex-col overflow-hidden p-0">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-text">Open a folder</span>
          </div>
          <button className="ds-btn ds-btn-ghost ds-focus !p-1.5" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Path bar */}
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2">
          <button
            className="ds-btn ds-btn-ghost ds-focus !p-1.5"
            onClick={() => data?.parent && browse(data.parent)}
            disabled={!data?.parent}
            title="Up one level"
            aria-label="Up one level"
          >
            <CornerLeftUp size={15} />
          </button>
          <button
            className="ds-btn ds-btn-ghost ds-focus !p-1.5"
            onClick={() => data?.home && browse(data.home)}
            title="Home"
            aria-label="Home"
          >
            <Home size={15} />
          </button>
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted" title={data?.path}>
            {data?.path ?? "…"}
          </span>
        </div>

        {/* Directory list */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted">
              <Loader2 className="ds-spin h-5 w-5" />
            </div>
          ) : data && data.dirs.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {data.dirs.map((d) => (
                <li key={d.path}>
                  <button
                    onClick={() => browse(d.path)}
                    className="ds-focus flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <Folder className="h-4 w-4 shrink-0 text-faint" />
                    <span className="truncate text-sm text-text">{d.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-xs text-faint">No subfolders here</p>
          )}
        </div>

        {/* Footer: open current */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
          <span className="min-w-0 truncate text-xs text-muted">
            Open <span className="font-mono text-text">{data?.path ?? ""}</span>
          </span>
          <button
            className="ds-btn ds-btn-primary ds-focus shrink-0 gap-1.5"
            onClick={() => data && onOpen(data.path)}
            disabled={!data}
          >
            <Check size={15} /> Open folder
          </button>
        </div>
      </div>
    </div>
  );
}
