import { NextRequest } from "next/server";

/**
 * Same-origin proxy to the stateless build/export worker.
 *
 * Real `slidev export` / `slidev build` need Node + Chromium, so they run in a
 * separate worker (see worker/server.mjs). This route only FORWARDS bytes to it:
 * it holds no pod credentials, writes nothing, and persists nothing — the
 * browser uploads the returned artifacts to the pod itself. Keeping the worker
 * behind this proxy means it stays on the internal network (no CORS, not public).
 *
 * This is NOT the old `/api/render` shared-file writer (deleted with the sidecar
 * render path); it is a pure forwarder.
 */

export const runtime = "nodejs";
// Builds spin up Vite + Chromium (10–60s); don't let the platform cut us off.
export const maxDuration = 300;

const WORKER_URL = process.env.RENDER_WORKER_URL ?? "http://localhost:3162";

export async function POST(req: NextRequest) {
  let body: { op?: string; slidesMd?: string; base?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const { op, slidesMd, base } = body;
  if ((op !== "export" && op !== "build") || !slidesMd?.trim()) {
    return new Response("expected { op: 'export'|'build', slidesMd, base? }", {
      status: 400,
    });
  }

  const payload = op === "build" ? { slidesMd, base: base ?? "/" } : { slidesMd };

  let upstream: Response;
  try {
    upstream = await fetch(`${WORKER_URL}/${op}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return new Response(
      `build worker unreachable at ${WORKER_URL} — is it running? (${
        e instanceof Error ? e.message : String(e)
      })`,
      { status: 502 }
    );
  }

  // Stream the worker's response (PDF bytes or build manifest JSON) straight back.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/octet-stream",
    },
  });
}
