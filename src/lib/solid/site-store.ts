"use client";

import {
  deleteContainer,
  deleteFile,
  getContainedResourceUrlAll,
  getSolidDataset,
  overwriteFile,
} from "@inrupt/solid-client";
import { sitesContainerFor } from "@/lib/config";
import type { SiteFile } from "@/lib/publish/render-client";
import { makeContainerPrivate, makeContainerPublic } from "./acl";
import { fetcher } from "./fetcher";

/**
 * Publishes a `slidev build` static site into the pod and (optionally) makes it
 * world-readable. The BROWSER does every write with the user's authed fetch —
 * the build worker never touches the pod. A site lives at
 * `<pod>/mind-slides/sites/<id>/` mirroring `index.html` + `assets/*`.
 */

export interface PublishResult {
  containerUrl: string;
  indexUrl: string;
  isPublic: boolean;
}

function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function publishSite(
  podRoot: string,
  id: string,
  files: SiteFile[],
  opts: { public: boolean },
): Promise<PublishResult> {
  const base = `${sitesContainerFor(podRoot)}${id}/`;
  const f = fetcher();

  // Replace any prior publish so removed files don't linger.
  await unpublishSite(podRoot, id).catch(() => {});

  // Upload all dist files. Correct content-types are essential — a static SPA
  // served with text/plain JS won't execute. Parallel, like listDecks().
  await Promise.all(
    files.map((file) =>
      overwriteFile(
        `${base}${file.path}`,
        new Blob([b64ToBuffer(file.base64)], { type: file.contentType }),
        {
          contentType: file.contentType,
          fetch: f,
        },
      ),
    ),
  );

  if (opts.public) await makeContainerPublic(base);

  return { containerUrl: base, indexUrl: `${base}index.html`, isPublic: opts.public };
}

/** Recursively remove a published site (LDP has no recursive delete). */
export async function unpublishSite(podRoot: string, id: string): Promise<void> {
  const base = `${sitesContainerFor(podRoot)}${id}/`;
  const f = fetcher();

  async function purge(container: string): Promise<void> {
    let ds;
    try {
      ds = await getSolidDataset(container, { fetch: f });
    } catch {
      return; // doesn't exist
    }
    const children = getContainedResourceUrlAll(ds);
    for (const child of children) {
      if (child.endsWith("/")) await purge(child);
      else await deleteFile(child, { fetch: f }).catch(() => {});
    }
    await deleteContainer(container, { fetch: f }).catch(() => {});
  }

  // Best-effort: drop public access first so a half-deleted site isn't exposed.
  await makeContainerPrivate(base).catch(() => {});
  await purge(base);
}
