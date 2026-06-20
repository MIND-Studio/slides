/**
 * Server-only client for the mind-node MIND ledger (operator surface). Slides
 * holds the operator token and spends a user's free allotment on their behalf:
 * it reads the balance before a company-key generation and debits a flat price
 * after one succeeds. Never import this from a client component — it carries the
 * operator token.
 *
 * Configuration (all server env):
 *   MIND_NODE_URL        e.g. https://pods.mindpods.org  (ledger base)
 *   MIND_OPERATOR_TOKEN  the SOLIDRS_ADMIN_TOKEN bearer
 *   MIND_LLM_PRICE       MIND debited per generation (default 1)
 *
 * Unset URL/token ⇒ the ledger is "off" for the app: no balance checks, no
 * debits, and generation behaves exactly as before this feature.
 *
 * Server-only: this module reads MIND_OPERATOR_TOKEN and must never be bundled
 * into a client component (it's imported only from the `/api/generate` route).
 */

export interface LedgerConfig {
  url: string;
  token: string;
  price: number;
}

/** Resolve config from env, or null when the ledger isn't wired up. */
export function ledgerConfig(): LedgerConfig | null {
  const url = process.env.MIND_NODE_URL?.trim().replace(/\/$/, "");
  const token = process.env.MIND_OPERATOR_TOKEN?.trim();
  if (!url || !token) return null;
  const price = Math.max(1, Number(process.env.MIND_LLM_PRICE ?? "1") || 1);
  return { url, token, price };
}

export function ledgerEnabled(): boolean {
  return ledgerConfig() !== null;
}

/**
 * The caller's MIND balance, or null when it can't be determined (ledger off,
 * disabled on the node, or unreachable). Callers treat null as "fail open" —
 * don't block generation on a ledger outage.
 */
export async function getBalance(webid: string): Promise<number | null> {
  const cfg = ledgerConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/.admin/tokens?owner=${encodeURIComponent(webid)}`, {
      headers: { authorization: `Bearer ${cfg.token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { balance?: number };
    return typeof body.balance === "number" ? body.balance : null;
  } catch {
    return null;
  }
}

export type DebitResult =
  | { ok: true; balance: number }
  | { ok: false; status: number; balance: number | null };

/**
 * Debit `amount` MIND from `webid`. A 402 means the balance was spent (the
 * caller should have checked first, but a concurrent run can drain it); the
 * generation has already happened, so the route logs and returns the deck
 * anyway rather than failing the user after the fact.
 */
export async function debit(webid: string, amount: number, memo: string): Promise<DebitResult> {
  const cfg = ledgerConfig();
  if (!cfg) return { ok: false, status: 0, balance: null };
  try {
    const res = await fetch(`${cfg.url}/.admin/tokens/debit`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ owner: webid, amount, memo }),
    });
    const body = (await res.json().catch(() => ({}))) as { balance?: number };
    if (res.ok) return { ok: true, balance: body.balance ?? 0 };
    return { ok: false, status: res.status, balance: body.balance ?? null };
  } catch {
    return { ok: false, status: 0, balance: null };
  }
}

/** Flat MIND price charged per metered generation. */
export function llmPrice(): number {
  return ledgerConfig()?.price ?? 1;
}
