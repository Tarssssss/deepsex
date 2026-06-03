/**
 * GET /api/file?path=<relative>
 *
 * Reads a single workspace file for the editor/preview pane. Resolved through
 * the workspace jail so paths cannot escape the sandbox.
 */
import fs from "node:fs/promises";
import { resolveActiveRoot, resolveInWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rel = url.searchParams.get("path");

  if (!rel) {
    return Response.json(
      { error: "Missing `path` query parameter." },
      { status: 400 }
    );
  }

  try {
    const root = await resolveActiveRoot(url.searchParams.get("root"));
    const abs = resolveInWorkspace(rel, root);
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    const content = await fs.readFile(abs, "utf8");
    return Response.json({ path: rel, content });
  } catch {
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
