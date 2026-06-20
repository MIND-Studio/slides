"use client";

import {
  createAcl,
  createAclFromFallbackAcl,
  getResourceAcl,
  getSolidDatasetWithAcl,
  hasAccessibleAcl,
  hasFallbackAcl,
  hasResourceAcl,
  saveAclFor,
  setPublicDefaultAccess,
  setPublicResourceAccess,
} from "@inrupt/solid-client";
import { fetcher } from "./fetcher";

/**
 * Web Access Control helpers. Community Solid Server uses WAC by default, so a
 * published site is made world-readable by writing an `.acl` on its container.
 *
 * Two access grants are needed and BOTH matter:
 *   - resource access  → the container resource itself is public-readable
 *   - default  access  → CONTAINED files (index.html, assets/*) inherit public
 *                        read. Without this the listing is public but the SPA's
 *                        own assets 403 and the page is blank.
 */
async function setContainerPublicRead(containerUrl: string, read: boolean): Promise<void> {
  const f = fetcher();
  const ds = await getSolidDatasetWithAcl(containerUrl, { fetch: f });
  if (!hasAccessibleAcl(ds)) {
    throw new Error(
      "No control access to set the site's sharing — your pod may not allow WAC here.",
    );
  }
  let acl = hasResourceAcl(ds)
    ? getResourceAcl(ds)!
    : hasFallbackAcl(ds)
      ? createAclFromFallbackAcl(ds)
      : createAcl(ds);

  acl = setPublicResourceAccess(acl, {
    read,
    append: false,
    write: false,
    control: false,
  });
  acl = setPublicDefaultAccess(acl, {
    read,
    append: false,
    write: false,
    control: false,
  });
  await saveAclFor(ds, acl, { fetch: f });
}

/** Grant world read on a published site container (+ its contents). */
export function makeContainerPublic(containerUrl: string): Promise<void> {
  return setContainerPublicRead(containerUrl, true);
}

/** Revoke world read (back to owner-only). */
export function makeContainerPrivate(containerUrl: string): Promise<void> {
  return setContainerPublicRead(containerUrl, false);
}
