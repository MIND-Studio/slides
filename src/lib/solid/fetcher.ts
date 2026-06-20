"use client";

import { brokerFetch, isBrokered } from "./broker";
import { session } from "./session";

/**
 * The authed fetch every pod operation uses.
 *
 * Inside the Mind shell (brokered mode) this is the shell's scope-checked broker
 * fetch — Slides talks to the pod through the shell's authed fetch with no
 * credential of its own. Standalone it's the local OIDC session's fetch. Shared
 * by deck-store and site-store so both go through the same boundary.
 */
export function fetcher(): typeof fetch {
  return isBrokered() ? brokerFetch : session().fetch;
}
