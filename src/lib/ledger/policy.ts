/**
 * Free-allotment generation policy (pure, no I/O — unit-tested in smoke.ts).
 *
 * New users get a free allotment of MIND (minted on signup into the mind-node
 * ledger). While they have a balance, generation runs on OUR company LLM key
 * and each run is metered (debited) by WebID. When the allotment is spent they
 * fall back to bringing their own key (BYOK); with a key they're never metered.
 * BYOK always wins, and when the ledger is switched off the app behaves exactly
 * as it did before this feature (company key, unmetered).
 */

export type Provider = "anthropic" | "openrouter";

export interface ByokKey {
  provider: Provider;
  apiKey: string;
}

export interface GenInputs {
  /** Is the mind-node ledger configured for this server (URL + operator token)? */
  ledgerEnabled: boolean;
  /** The caller's WebID, if logged in (from `x-mind-webid`). */
  webid: string | null;
  /** A user-supplied key, if any — takes precedence over everything. */
  byok: ByokKey | null;
  /** The company provider picked from server env, or null if no company key. */
  companyProvider: Provider | null;
  /**
   * The caller's MIND balance, or null when not looked up (ledger off,
   * anonymous, BYOK, or the ledger was unreachable — fail open).
   */
  balance: number | null;
}

export type GenChoice =
  | { kind: "byok"; provider: Provider; apiKey: string }
  | { kind: "company"; meter: boolean }
  | { kind: "offline" }
  | { kind: "out_of_free"; balance: number };

/**
 * Decide which backend serves a generation, and whether to meter it.
 *
 * Order matters:
 *  1. BYOK wins outright and is never metered.
 *  2. No company key at all → offline composer (today's no-key behavior).
 *  3. Ledger off → company key, unmetered (today's behavior, unchanged).
 *  4. Ledger on but the caller is anonymous → don't spend company funds on an
 *     unattributable request; use the offline composer.
 *  5. Ledger on, known user, balance spent → tell them to add a key (402).
 *  6. Ledger on, known user, has balance (or balance unknown → fail open) →
 *     company key, metered.
 */
export function chooseGenerationPath(i: GenInputs): GenChoice {
  if (i.byok) return { kind: "byok", provider: i.byok.provider, apiKey: i.byok.apiKey };
  if (!i.companyProvider) return { kind: "offline" };
  if (!i.ledgerEnabled) return { kind: "company", meter: false };
  if (!i.webid) return { kind: "offline" };
  if (i.balance !== null && i.balance <= 0) return { kind: "out_of_free", balance: i.balance };
  return { kind: "company", meter: true };
}

/** Best-effort provider guess for a BYOK key when the client didn't say. */
export function inferProvider(apiKey: string): Provider {
  return apiKey.startsWith("sk-ant-") ? "anthropic" : "openrouter";
}
