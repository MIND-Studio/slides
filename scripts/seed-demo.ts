/**
 * Seed alice's pod with the example decks under `mind-slides/decks/<id>/`
 * (deck.json + slides.md + meta.json each), so the studio's pod library has
 * material on a fresh pod.
 *
 * Usage (targets THIS prototype's local CSS on :3102 by default):
 *   docker compose up -d
 *   npm run seed:demo
 *
 * Idempotent — re-running overwrites the seed resources.
 */
import { Session } from "@inrupt/solid-client-authn-node";
import { exampleDecks } from "../src/lib/spec/examples";
import { serializeDeck } from "../src/lib/spec/serialize";
import { deckId } from "../src/lib/config";

const POD_BASE = process.env.POD_BASE_URL ?? "http://localhost:3102/";
const EMAIL = process.env.SEED_EMAIL ?? "alice@mind-slides.local";
const PASSWORD = process.env.SEED_PASSWORD ?? "dev-only-do-not-use-in-prod";
const POD_NAME = process.env.SEED_POD ?? "alice";

const ROOT = `${POD_BASE}${POD_NAME}/`;
const WEBID = `${ROOT}profile/card#me`;
const DECKS = `${ROOT}mind-slides/decks/`;

async function mintCredentials() {
  const indexRes = await fetch(`${POD_BASE}.account/`);
  if (!indexRes.ok) {
    throw new Error(`CSS account index ${indexRes.status} — is CSS running?`);
  }
  const { controls } = (await indexRes.json()) as {
    controls: { password: { login: string } };
  };

  const loginRes = await fetch(controls.password.login, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  const { authorization } = (await loginRes.json()) as { authorization: string };

  const accountRes = await fetch(`${POD_BASE}.account/`, {
    headers: { Authorization: `CSS-Account-Token ${authorization}` },
  });
  const account = (await accountRes.json()) as {
    controls: { account: { clientCredentials: string } };
  };

  const credRes = await fetch(account.controls.account.clientCredentials, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `CSS-Account-Token ${authorization}`,
    },
    body: JSON.stringify({ name: "mind-slides-seed", webId: WEBID }),
  });
  if (!credRes.ok) {
    throw new Error(`Credentials creation failed: ${credRes.status} ${await credRes.text()}`);
  }
  return (await credRes.json()) as { id: string; secret: string };
}

async function put(session: Session, url: string, body: string, type: string) {
  const res = await session.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": type },
    body,
  });
  if (!res.ok) throw new Error(`PUT ${url} → ${res.status} ${await res.text()}`);
  process.stdout.write(`  · wrote ${url}\n`);
}

async function main() {
  const { id, secret } = await mintCredentials();
  const session = new Session();
  await session.login({
    clientId: id,
    clientSecret: secret,
    oidcIssuer: POD_BASE,
  });
  if (!session.info.isLoggedIn) throw new Error("Client-credentials login failed");

  const now = new Date().toISOString();
  for (const deck of exampleDecks) {
    const did = deckId(deck.title, now.replace(/[^0-9]/g, "").slice(8, 14) + Math.floor(Math.random() * 90 + 10));
    const base = `${DECKS}${did}/`;
    const meta = {
      id: did,
      title: deck.title,
      theme: deck.theme,
      slideCount: deck.slides.length,
      updatedAt: now,
    };
    await put(session, `${base}deck.json`, JSON.stringify(deck, null, 2), "application/json");
    await put(session, `${base}slides.md`, serializeDeck(deck), "text/markdown");
    await put(session, `${base}meta.json`, JSON.stringify(meta, null, 2), "application/json");
  }

  process.stdout.write(`\n✓ Seeded ${exampleDecks.length} decks to ${DECKS}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
