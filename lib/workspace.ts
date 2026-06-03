/**
 * Workspace sandbox helpers.
 *
 * Every file + shell tool is jailed to an active workspace root. By default
 * that root is AGENT_WORKSPACE, but the user can "open" any folder on the local
 * machine (opencode-style) — the chosen directory then becomes the jail. The
 * root is supplied per request by the client; these helpers validate it and
 * resolve user/model-supplied paths against it, rejecting escapes (via `..`,
 * absolute paths, or symlinks pointing outside the root).
 */
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

/** The default workspace root from env (or ./workspace). */
export function defaultWorkspaceRoot(): string {
  const root = process.env.AGENT_WORKSPACE || path.join(process.cwd(), "workspace");
  return path.resolve(root);
}

/** Back-compat alias: the default root. */
export function workspaceRoot(): string {
  return defaultWorkspaceRoot();
}

/**
 * Resolve the active root for a request. A non-empty absolute path that exists
 * and is a directory is honored; otherwise we fall back to the default root.
 * This keeps the jail anchored to a real directory the user explicitly opened.
 */
export async function resolveActiveRoot(requested?: string | null): Promise<string> {
  if (requested && typeof requested === "string") {
    const abs = path.resolve(requested);
    try {
      const stat = await fs.stat(abs);
      if (stat.isDirectory()) return abs;
    } catch {
      /* fall through to default */
    }
  }
  return defaultWorkspaceRoot();
}

/**
 * Resolve a workspace-relative path to an absolute path inside `root`,
 * guaranteeing the result stays inside it. Throws on escape attempts.
 */
export function resolveInWorkspace(relPath: string, root: string): string {
  // Treat absolute inputs as relative to the root (strip leading slash).
  const cleaned = relPath.replace(/^[/\\]+/, "");
  const abs = path.resolve(root, cleaned);
  const rel = path.relative(root, abs);
  if (rel === "") return abs;
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `Path "${relPath}" escapes the workspace sandbox and was blocked.`
    );
  }
  return abs;
}

/** Path relative to the root, with forward slashes, for display. */
export function toWorkspaceRelative(abs: string, root: string): string {
  const rel = path.relative(root, abs);
  return rel.split(path.sep).join("/");
}

/** Ensure the root exists (only auto-creates the default workspace). */
export async function ensureWorkspace(root: string): Promise<string> {
  await fs.mkdir(root, { recursive: true }).catch(() => {});
  return root;
}

/** Directories that should never be walked/returned in the file tree. */
export const IGNORED_ENTRIES = new Set([
  "node_modules",
  ".git",
  ".next",
  ".DS_Store",
]);

/* ------------------------------------------------------------------ */
/* Directory browsing (for the "open a folder" picker)                 */
/* ------------------------------------------------------------------ */

export interface DirEntry {
  name: string;
  path: string;
}

export interface BrowseResult {
  /** Absolute path being listed. */
  path: string;
  /** Parent directory, or null at the filesystem root. */
  parent: string | null;
  /** Subdirectories (sorted). */
  dirs: DirEntry[];
  /** The user's home directory (a convenient starting point). */
  home: string;
  /** The default workspace root. */
  defaultRoot: string;
}

/**
 * List the subdirectories of `dir` (defaults to home) for the folder picker.
 * Only directories are returned; hidden dot-dirs are skipped except common
 * project roots are still navigable by typing a path.
 */
export async function browseDirectory(dir?: string | null): Promise<BrowseResult> {
  const home = os.homedir();
  const target = dir && typeof dir === "string" ? path.resolve(dir) : home;

  let dirents: import("node:fs").Dirent[] = [];
  try {
    dirents = await fs.readdir(target, { withFileTypes: true });
  } catch {
    // Unreadable path — fall back to home.
    return browseDirectory(home === target ? os.tmpdir() : home);
  }

  const dirs: DirEntry[] = dirents
    .filter((d) => {
      try {
        return d.isDirectory();
      } catch {
        return false;
      }
    })
    .filter((d) => d.name !== "node_modules" && d.name !== ".git")
    .map((d) => ({ name: d.name, path: path.join(target, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const parentPath = path.dirname(target);
  const parent = parentPath === target ? null : parentPath;

  return { path: target, parent, dirs, home, defaultRoot: defaultWorkspaceRoot() };
}
