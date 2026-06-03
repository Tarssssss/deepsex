/**
 * POST /api/agents/test
 *
 * Lightweight connection probe for a custom agent's provider config. Hits
 * `{baseUrl}/models` with the API key and reports ok/status/latency/message so
 * the editor can show a "Test connection" result. Stateless; stores nothing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TestBody {
  baseUrl: string;
  apiKey: string;
}

export async function POST(request: Request): Promise<Response> {
  let body: TestBody;
  try {
    body = (await request.json()) as TestBody;
  } catch {
    return Response.json({ ok: false, message: "Invalid request." });
  }
  if (!body?.baseUrl) {
    return Response.json({ ok: false, message: "Missing base URL." });
  }

  const url = body.baseUrl.replace(/\/+$/, "") + "/models";
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${body.apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - started;
    if (res.ok) {
      return Response.json({ ok: true, status: res.status, latencyMs });
    }
    const message =
      res.status === 401 || res.status === 403
        ? `Authentication failed (${res.status}) — check the API key.`
        : `Provider responded ${res.status} ${res.statusText}.`;
    return Response.json({ ok: false, status: res.status, latencyMs, message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const aborted = msg.toLowerCase().includes("abort");
    return Response.json({
      ok: false,
      message: aborted
        ? "Timed out reaching the provider."
        : `Couldn't reach the host. Check the base URL. (${msg})`,
    });
  }
}
