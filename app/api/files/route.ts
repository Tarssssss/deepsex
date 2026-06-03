/**
 * GET /api/files
 *
 * Returns the workspace file tree (directories first, then files, alphabetical)
 * for the sidebar file explorer. Ignored entries (node_modules, .git, …) are
 * skipped entirely.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { FileNode } from "@/lib/types";
import {
  ensureWorkspace,
  resolveActiveRoot,
  IGNORED_ENTRIES,
} from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const root = await resolveActiveRoot(url.searchParams.get("root"));
  await ensureWorkspace(root);
  const tree = await buildTree(root, root);
  return Response.json({ root, tree });
}

async function buildTree(dir: string, root: string): Promise<FileNode[]> {
  let dirents;
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  dirents.sort((a, b) => {
    const aDir = a.isDirectory() ? 0 : 1;
    const bDir = b.isDirectory() ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    return a.name.localeCompare(b.name);
  });

  const nodes: FileNode[] = [];
  for (const dirent of dirents) {
    if (IGNORED_ENTRIES.has(dirent.name)) continue;
    const abs = path.join(dir, dirent.name);
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (dirent.isDirectory()) {
      nodes.push({
        name: dirent.name,
        path: rel,
        type: "dir",
        children: await buildTree(abs, root),
      });
    } else {
      nodes.push({ name: dirent.name, path: rel, type: "file" });
    }
  }
  return nodes;
}
