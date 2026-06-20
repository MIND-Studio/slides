/**
 * Live integration check for the ledger client against a running mind-node.
 * Not part of `npm test` (it needs a node + seeded balance); run manually:
 *   MIND_NODE_URL=http://localhost:3099 MIND_OPERATOR_TOKEN=test-admin-secret \
 *     MIND_LLM_PRICE=1 npx tsx scripts/ledger-integration.ts
 */
import assert from "node:assert/strict";
import { getBalance, debit, ledgerEnabled, llmPrice } from "../src/lib/ledger/client";

const WEBID = "https://pods/u#me"; // seeded with 3 MIND by the caller

async function main() {
  assert.equal(ledgerEnabled(), true, "ledger should be configured from env");
  assert.equal(llmPrice(), 1, "price should be 1");

  const start = await getBalance(WEBID);
  console.log("  start balance:", start);
  assert.equal(start, 3, "seeded balance should be 3");

  const d1 = await debit(WEBID, 1, "slides:generate");
  assert.ok(d1.ok && d1.balance === 2, `first debit → 2, got ${JSON.stringify(d1)}`);
  console.log("  after debit 1:", d1.balance);

  const d2 = await debit(WEBID, 2, "slides:generate");
  assert.ok(d2.ok && d2.balance === 0, `drain → 0, got ${JSON.stringify(d2)}`);
  console.log("  after debit 2:", d2.balance);

  const empty = await getBalance(WEBID);
  assert.equal(empty, 0, "balance should now be 0");

  const over = await debit(WEBID, 1, "slides:generate");
  assert.ok(!over.ok && over.status === 402, `over-debit → 402, got ${JSON.stringify(over)}`);
  console.log("  over-debit status:", over.status, "(402 = out of free usage)");

  // Unknown owner reads as 0 (fresh account), never throws.
  const unknown = await getBalance("https://pods/nobody#me");
  assert.equal(unknown, 0, "unknown owner → 0");

  console.log("\n✓ ledger client integration passed");
}

main().catch((e) => {
  console.error("✗ integration failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
