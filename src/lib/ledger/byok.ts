"use client";

import { session } from "@/lib/solid/session";
import { inferProvider } from "@/lib/ledger/policy";

/**
 * Client helpers for the free-allotment flow: who the caller is (WebID, for
 * metering) and their own LLM key (BYOK, used once the free allotment is spent).
 * The key is held in localStorage and sent per-request as `x-mind-llm-key`; it
 * never goes to our server's store — only straight through to the provider.
 */

const KEY_STORAGE = "mind.slides.byok.key";
const PROVIDER_STORAGE = "mind.slides.byok.provider";

export type Provider = "anthropic" | "openrouter";

/**
 * Best-effort provider guess for a pasted key. Re-exported from the shared
 * policy module so the client and the server's `/api/generate` infer providers
 * identically (one source of truth — no drift).
 */
export const inferProviderFromKey = inferProvider;

/** The logged-in caller's WebID, or null when anonymous. */
export function callerWebId(): string | null {
  try {
    return session().info.webId ?? null;
  } catch {
    return null;
  }
}

export function getUserKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY_STORAGE);
}

export function getUserProvider(): Provider | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(PROVIDER_STORAGE);
  return v === "anthropic" || v === "openrouter" ? v : null;
}

export function setUserKey(key: string | null, provider?: Provider | null): void {
  if (typeof window === "undefined") return;
  if (key && key.trim()) {
    window.localStorage.setItem(KEY_STORAGE, key.trim());
    if (provider) window.localStorage.setItem(PROVIDER_STORAGE, provider);
  } else {
    window.localStorage.removeItem(KEY_STORAGE);
    window.localStorage.removeItem(PROVIDER_STORAGE);
  }
}

/** Headers that carry identity + (optional) BYOK key to `/api/generate`. */
export function ledgerHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const webid = callerWebId();
  if (webid) headers["x-mind-webid"] = webid;
  const key = getUserKey();
  if (key) {
    headers["x-mind-llm-key"] = key;
    const provider = getUserProvider();
    if (provider) headers["x-mind-llm-provider"] = provider;
  }
  return headers;
}
