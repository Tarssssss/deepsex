"use client";

import { useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
} from "lucide-react";
import type { FileNode } from "@/lib/types";

interface FileTreeProps {
  nodes: FileNode[];
  selectedPath?: string | null;
  onSelect: (path: string) => void;
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPath?: string | null;
  onSelect: (path: string) => void;
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function TreeNode({ node, depth, selectedPath, onSelect }: TreeNodeProps) {
  const [open, setOpen] = useState(depth === 0);
  const indent = 8 + depth * 14;

  if (node.type === "dir") {
    const children = node.children ? sortNodes(node.children) : [];
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ds-focus flex w-full items-center gap-1.5 rounded-[6px] py-1 pr-2 text-left text-sm text-text hover:bg-surface-2"
          style={{ paddingLeft: indent }}
          aria-expanded={open}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
          {open ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-brand" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open &&
          children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const selected = node.path === selectedPath;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={`ds-focus flex w-full items-center gap-1.5 rounded-[6px] py-1 pr-2 text-left text-sm hover:bg-surface-2 ${
        selected ? "bg-brand-soft text-brand" : "text-text"
      }`}
      style={{ paddingLeft: indent + 18 }}
    >
      <FileText
        className={`h-4 w-4 shrink-0 ${selected ? "text-brand" : "text-faint"}`}
      />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTree({ nodes, selectedPath, onSelect }: FileTreeProps) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-sm text-faint">No files</div>
    );
  }

  return (
    <div className="flex flex-col gap-px py-1">
      {sortNodes(nodes).map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
