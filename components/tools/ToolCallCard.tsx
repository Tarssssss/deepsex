"use client";

import { useState } from "react";
import {
  FileText,
  FilePlus,
  Pencil,
  FolderTree,
  Terminal,
  Wrench,
  Check,
  X,
  AlertCircle,
  Loader2,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type { ToolInvocation } from "@/lib/types";
import { DiffView } from "./DiffView";
import { CommandOutput } from "./CommandOutput";

interface ToolCallCardProps {
  tool: ToolInvocation;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  needsApproval?: boolean;
}

function iconFor(name: string): LucideIcon {
  switch (name) {
    case "read_file":
      return FileText;
    case "write_file":
      return FilePlus;
    case "edit_file":
      return Pencil;
    case "list_files":
      return FolderTree;
    case "run_command":
      return Terminal;
    default:
      return Wrench;
  }
}

function asString(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  return String(v);
}

interface Summary {
  verb: string;
  label: string;
  /** Render the target in monospace (paths, commands). */
  mono: boolean;
}

function summarize(tool: ToolInvocation): Summary {
  const { name, args } = tool;
  const path = asString(args.path);
  const command = asString(args.command);
  switch (name) {
    case "read_file":
      return { verb: "Read", label: path, mono: true };
    case "write_file":
      return { verb: "Write", label: path, mono: true };
    case "edit_file":
      return { verb: "Edit", label: path, mono: true };
    case "list_files":
      return { verb: "List", label: path || "workspace", mono: !!path };
    case "run_command":
      return { verb: "Run", label: command, mono: true };
    default:
      return { verb: name, label: "", mono: false };
  }
}

function approvalVerb(tool: ToolInvocation): string {
  const s = summarize(tool);
  const target = s.label ? ` ${s.label}` : "";
  switch (tool.name) {
    case "read_file":
      return `read ${s.label}`;
    case "write_file":
      return `write to ${s.label}`;
    case "edit_file":
      return `edit ${s.label}`;
    case "list_files":
      return `list ${s.label}`;
    case "run_command":
      return `run ${s.label}`;
    default:
      return `run ${tool.name}${target}`;
  }
}

function StatusIndicator({ status }: { status: ToolInvocation["status"] }) {
  switch (status) {
    case "pending":
      return (
        <span className="flex items-center gap-1.5 text-xs text-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-faint" />
          Proposed
        </span>
      );
    case "running":
      return <Loader2 className="ds-spin h-4 w-4 text-brand" />;
    case "success":
      return <Check className="h-4 w-4 text-success" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-error" />;
    case "rejected":
      return <span className="text-xs text-muted">Skipped</span>;
    default:
      return null;
  }
}

function hasMeaningfulContent(tool: ToolInvocation): boolean {
  if (tool.error) return true;
  if (tool.name === "write_file" || tool.name === "edit_file") {
    return !!tool.meta?.diff;
  }
  if (tool.name === "run_command") {
    return (
      !!tool.meta?.command ||
      !!tool.meta?.stdout ||
      !!tool.meta?.stderr ||
      typeof tool.meta?.exitCode === "number"
    );
  }
  return !!tool.result || (tool.meta?.entries?.length ?? 0) > 0;
}

function ExpandedBody({ tool }: { tool: ToolInvocation }) {
  const { name, meta } = tool;

  return (
    <div className="border-t border-border p-3">
      {tool.error && (
        <div className="mb-2 rounded-[8px] border border-border px-3 py-2 text-xs text-error">
          {tool.error}
        </div>
      )}

      {(name === "write_file" || name === "edit_file") && meta?.diff && (
        <DiffView diff={meta.diff} path={meta.path} />
      )}

      {name === "run_command" && (
        <CommandOutput
          command={meta?.command}
          stdout={meta?.stdout}
          stderr={meta?.stderr}
          exitCode={meta?.exitCode}
        />
      )}

      {(name === "read_file" || name === "list_files") &&
        (() => {
          const text =
            (meta?.entries && meta.entries.length > 0
              ? meta.entries.join("\n")
              : tool.result) ?? "";
          if (!text) return null;
          return (
            <pre
              className="max-h-64 overflow-auto rounded-[10px] border border-border px-3 py-2 font-mono text-xs whitespace-pre-wrap text-muted"
              style={{ background: "var(--code-bg)" }}
            >
              {text}
            </pre>
          );
        })()}
    </div>
  );
}

export function ToolCallCard({
  tool,
  onApprove,
  onReject,
  needsApproval,
}: ToolCallCardProps) {
  const Icon = iconFor(tool.name);
  const summary = summarize(tool);

  const meaningful = hasMeaningfulContent(tool);
  const defaultExpanded =
    (tool.status === "success" || tool.status === "error") && meaningful;
  const [expanded, setExpanded] = useState(defaultExpanded);

  const showApproval =
    !!needsApproval && !!onApprove && tool.status === "pending";

  const canExpand = meaningful;

  return (
    <div className="ds-card ds-fade-up overflow-hidden p-0">
      <button
        type="button"
        onClick={() => canExpand && setExpanded((v) => !v)}
        className="ds-focus flex w-full items-center gap-3 px-3 py-2.5 text-left"
        aria-expanded={expanded}
        disabled={!canExpand}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-brand-soft text-brand">
          <Icon className="h-4 w-4" />
        </span>

        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="shrink-0 text-sm font-medium text-text">
            {summary.verb}
          </span>
          {summary.label && (
            <span
              className={`truncate text-sm text-muted ${
                summary.mono ? "font-mono text-xs" : ""
              }`}
            >
              {summary.label}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <StatusIndicator status={tool.status} />
          {canExpand && (
            <ChevronRight
              className={`h-4 w-4 text-faint transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
            />
          )}
        </span>
      </button>

      {expanded && canExpand && <ExpandedBody tool={tool} />}

      {showApproval && (
        <div className="flex flex-col gap-2 border-t border-border bg-surface-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            DeepSex wants to {approvalVerb(tool)}. Allow?
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="ds-btn"
              onClick={() => onReject?.(tool.id)}
            >
              Reject
            </button>
            <button
              type="button"
              className="ds-btn ds-btn-primary"
              onClick={() => onApprove?.(tool.id)}
            >
              Approve
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
