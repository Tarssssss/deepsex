/**
 * GET /api/browse?path=<dir>
 *
 * Lists the subdirectories of a directory on the local machine so the user can
 * pick a folder to "open" as the agent's workspace (opencode-style). Because
 * the app runs locally, the server filesystem IS the user's machine; this
 * endpoint only ever returns directory listings (never file contents).
 */
import { browseDirectory } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const dir = url.searchParams.get("path");
  try {
    const result = await browseDirectory(dir);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
