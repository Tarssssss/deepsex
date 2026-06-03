"use client";

import { useMemo } from "react";
import hljs from "highlight.js";

interface FileViewerProps {
  path: string | null;
  content: string;
  loading?: boolean;
}

const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "html",
  md: "markdown",
  py: "python",
  rs: "rust",
  go: "go",
  sh: "bash",
  bash: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  sql: "sql",
};

function highlight(path: string | null, content: string): string {
  const ext = path?.split(".").pop()?.toLowerCase();
  const lang = ext ? EXT_LANG[ext] : undefined;
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(content, { language: lang }).value;
    }
    return hljs.highlightAuto(content).value;
  } catch {
    return escapeHtml(content);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function FileViewer({ path, content, loading }: FileViewerProps) {
  const html = useMemo(
    () => (path ? highlight(path, content) : ""),
    [path, content]
  );

  const lineCount = useMemo(
    () => (content ? content.split("\n").length : 0),
    [content]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="ds-shimmer text-sm text-faint">Loading…</span>
      </div>
    );
  }

  if (!path) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <span className="text-sm text-faint">Select a file to view</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Theme-aware highlight.js token colors (driven by design tokens so
          the same rules work in both light and dark). */}
      <style>{`
        .ds-hljs .hljs { color: var(--text); background: transparent; }
        .ds-hljs .hljs-comment,
        .ds-hljs .hljs-quote { color: var(--faint); font-style: italic; }
        .ds-hljs .hljs-keyword,
        .ds-hljs .hljs-selector-tag,
        .ds-hljs .hljs-built_in,
        .ds-hljs .hljs-name,
        .ds-hljs .hljs-tag { color: var(--brand); }
        .ds-hljs .hljs-string,
        .ds-hljs .hljs-title,
        .ds-hljs .hljs-section,
        .ds-hljs .hljs-attribute,
        .ds-hljs .hljs-literal,
        .ds-hljs .hljs-template-tag,
        .ds-hljs .hljs-template-variable,
        .ds-hljs .hljs-type,
        .ds-hljs .hljs-addition { color: var(--success); }
        .ds-hljs .hljs-number,
        .ds-hljs .hljs-symbol,
        .ds-hljs .hljs-bullet,
        .ds-hljs .hljs-link,
        .ds-hljs .hljs-meta,
        .ds-hljs .hljs-deletion { color: var(--warning); }
        .ds-hljs .hljs-variable,
        .ds-hljs .hljs-attr,
        .ds-hljs .hljs-params,
        .ds-hljs .hljs-property { color: var(--text); }
        .ds-hljs .hljs-emphasis { font-style: italic; }
        .ds-hljs .hljs-strong { font-weight: 600; }
      `}</style>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
        <span className="truncate font-mono text-sm text-text">{path}</span>
        <span className="shrink-0 text-xs text-faint">
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </span>
      </div>
      <div
        className="ds-hljs min-h-0 flex-1 overflow-auto"
        style={{ background: "var(--code-bg)" }}
      >
        <pre className="px-4 py-3 text-xs leading-relaxed">
          <code
            className="hljs font-mono"
            style={{ background: "transparent" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </pre>
      </div>
    </div>
  );
}
