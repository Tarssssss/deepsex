/**
 * Workspace sandbox helpers.
 *
 * Every file + shell tool is jailed to AGENT_WORKSPACE. These helpers resolve
 * user/model-supplied paths against the workspace root and reject any attempt
 * to escape it (via `..`, absolute paths, or symlinks pointing outside).
 */
import path from "node:path";
import fs from "node:fs/promises";

export function workspaceRoot(): string {
  const root =
    process.env.AGENT_WORKSPACE ||
    path.join(process.cwd(), "workspace");
  return path.resolve(root);
}

/**
 * Resolve a workspace-relative path to an absolute path, guaranteeing the
 * result stays inside the workspace root. Throws on escape attempts.
 */
export function resolveInWorkspace(relPath: string): string {
  const root = workspaceRoot();
  // Treat absolute inputs as relative to the workspace root (strip leading /).
  const cleaned = relPath.replace(/^[/\\]+/, "");
  const abs = path.resolve(root, cleaned);
  const rel = path.relative(root, abs);
  if (rel === "" ) return abs;
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `Path "${relPath}" escapes the workspace sandbox and was blocked.`
    );
  }
  return abs;
}

/** Path relative to workspace root, with forward slashes, for display. */
export function toWorkspaceRelative(abs: string): string {
  const rel = path.relative(workspaceRoot(), abs);
  return rel.split(path.sep).join("/");
}

export async function ensureWorkspace(): Promise<string> {
  const root = workspaceRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

/** Directories that should never be walked/returned in the file tree. */
export const IGNORED_ENTRIES = new Set([
  "node_modules",
  ".git",
  ".next",
  ".DS_Store",
]);
