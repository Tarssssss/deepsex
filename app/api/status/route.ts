/**
 * GET /api/status
 *
 * Tiny capability probe for first-run onboarding: tells the client whether the
 * server already has a DEEPSEEK_API_KEY in its environment. If it does, the UI
 * doesn't need to nag the user to paste one. Never returns the key itself.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({ hasEnvKey: !!process.env.DEEPSEEK_API_KEY });
}
