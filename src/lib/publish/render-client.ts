"use client";

/**
 * Browser-side calls to the build/export worker, via the same-origin
 * `/api/render` proxy. The worker is stateless and credential-free; it returns
 * artifacts (a PDF blob, or a static-site manifest) which the CALLER then writes
 * to the pod with the user's own authed fetch — so no Mind server ever holds pod
 * credentials or persists a deck.
 */

/** One built file from `slidev build`, base64-encoded for JSON transport. */
export interface SiteFile {
  path: string;
  base64: string;
  contentType: string;
}

async function failMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return text || `${res.status} ${res.statusText}`;
}

/** Real Slidev PDF (Chromium). Returns the PDF as a Blob. */
export async function exportPdf(slidesMd: string): Promise<Blob> {
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op: "export", slidesMd }),
  });
  if (!res.ok) throw new Error(`Export failed: ${await failMessage(res)}`);
  return res.blob();
}

/**
 * `slidev build` → static SPA. `base` is the pod URL path the site is served
 * from (see siteBaseForId) so asset URLs resolve. Returns the dist file list.
 */
export async function buildSite(
  slidesMd: string,
  base: string
): Promise<SiteFile[]> {
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op: "build", slidesMd, base }),
  });
  if (!res.ok) throw new Error(`Build failed: ${await failMessage(res)}`);
  const json = (await res.json()) as { files: SiteFile[] };
  return json.files;
}
