/**
 * Spec smoke tests — the fast, dependency-free check that the spec pipeline
 * (schema → validate/clamp → serialize, plus the offline composer/reviser and
 * pod URL helpers) still holds its invariants. Run with `npm test`.
 */
import assert from "node:assert/strict";
import { deckSchema, type DeckSpec } from "../src/lib/spec/schema";
import { validateDeck, clampDeck } from "../src/lib/spec/validate";
import { serializeDeck } from "../src/lib/spec/serialize";
import { composeDeck, reviseDeck } from "../src/lib/spec/compose";
import { exampleDecks, galleryDeck } from "../src/lib/spec/examples";
import { podRootFromWebId, decksContainerFor, deckId } from "../src/lib/config";
import { sanitizeTarget, sanitizeTargets } from "../src/lib/spec/target";
import { chooseGenerationPath, inferProvider } from "../src/lib/ledger/policy";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (e) {
    process.stderr.write(`  ✗ ${name}\n    ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  }
}

/** Validate + serialize, asserting the markdown's basic shape. */
function roundTrip(deck: DeckSpec): string {
  const check = validateDeck(deck);
  assert.ok(check.ok, !check.ok ? check.error : "");
  const md = serializeDeck(check.ok ? check.deck : deck);
  // Every slide is one frontmatter block fenced by exactly two `---` lines.
  const fences = md.match(/^---$/gm)?.length ?? 0;
  assert.equal(fences, deck.slides.length * 2);
  for (const slide of deck.slides) {
    assert.ok(md.includes(`layout: "${slide.block}"`), `layout ${slide.block} missing`);
  }
  assert.ok(md.includes(`class: "palette-${deck.theme}"`));
  return md;
}

process.stdout.write("examples\n");
for (const deck of exampleDecks) {
  test(`"${deck.title}" round-trips`, () => {
    const md = roundTrip(deck);
    assert.ok(md.startsWith("---\n"));
    assert.ok(md.includes(`title: ${JSON.stringify(deck.title)}`));
  });
}

test("gallery exercises every block", () => {
  const blocks = new Set(galleryDeck.slides.map((s) => s.block));
  assert.equal(blocks.size, 10);
});

test("serialized data is namespaced (no reserved-key collisions)", () => {
  const md = roundTrip(galleryDeck);
  // Block fields must only appear inside the JSON-encoded `data:` line, never
  // as bare frontmatter keys that would collide with Slidev's reserved ones.
  for (const line of md.split("\n")) {
    if (/^(kicker|headline|subtitle|bullets|items|left|right):/.test(line)) {
      assert.fail(`unnamespaced block field leaked into frontmatter: ${line}`);
    }
  }
});

process.stdout.write("composer\n");
test("composeDeck produces a valid deck from a brief", () => {
  const deck = composeDeck(
    "A 6-slide pitch for Aurora, a privacy-first notes app. 50000 active users. Compare us to cloud incumbents; end on a section break.",
    "mind"
  );
  const check = validateDeck(deck);
  assert.ok(check.ok);
  assert.ok(deck.slides.length >= 3);
  assert.equal(deck.slides[0].block, "title");
  roundTrip(deck);
});

test("composeDeck survives a degenerate brief", () => {
  const deck = composeDeck("x", "arctic");
  assert.ok(validateDeck(deck).ok);
  assert.equal(deck.theme, "arctic");
});

process.stdout.write("reviser\n");
test("reviseDeck switches theme on request", () => {
  const next = reviseDeck(galleryDeck, "switch the theme to arctic");
  assert.equal(next.theme, "arctic");
  assert.ok(validateDeck(next).ok);
});

test("reviseDeck removes a slide by number", () => {
  const next = reviseDeck(galleryDeck, "remove slide 2");
  assert.equal(next.slides.length, galleryDeck.slides.length - 1);
  assert.notEqual(next.slides[1], galleryDeck.slides[1]);
  assert.ok(validateDeck(next).ok);
});

test("reviseDeck adds a quote before the closer", () => {
  const next = reviseDeck(galleryDeck, "add a quote: Privacy is a feature.");
  assert.equal(next.slides.length, galleryDeck.slides.length + 1);
  assert.equal(next.slides[next.slides.length - 2].block, "quote");
  assert.ok(validateDeck(next).ok);
});

test("reviseDeck shortens long decks", () => {
  const next = reviseDeck(galleryDeck, "make it shorter");
  assert.ok(next.slides.length < galleryDeck.slides.length);
  assert.equal(next.slides[next.slides.length - 1], galleryDeck.slides[galleryDeck.slides.length - 1]);
  assert.ok(validateDeck(next).ok);
});

test("reviseDeck always changes something", () => {
  const next = reviseDeck(galleryDeck, "more about the developer experience");
  assert.notDeepEqual(next, galleryDeck);
  assert.ok(validateDeck(next).ok);
});

process.stdout.write("targeted reviser\n");
// galleryDeck slide order: 1 title, 2 agenda, 3 section, 4 hero, 5 bigNumber,
// 6 comparison, 7 timeline, 8 content, 9 quote, 10 imageFocus.
test("targeted: quoted text sets the selected field, rest untouched", () => {
  const next = reviseDeck(galleryDeck, 'change it to "Privacy wins."', {
    slide: 4,
    field: "headline",
  });
  const hero = next.slides[3];
  assert.equal(hero.block === "hero" && hero.headline, "Privacy wins.");
  // Every other slide is the same object — structurally shared, not rewritten.
  for (let i = 0; i < next.slides.length; i++) {
    if (i !== 3) assert.equal(next.slides[i], galleryDeck.slides[i]);
  }
  assert.ok(validateDeck(next).ok);
});

test("targeted: 'punchier' shortens the field instead of replacing it", () => {
  const before = galleryDeck.slides[3];
  const next = reviseDeck(galleryDeck, "make it punchier", { slide: 4, field: "headline" });
  const hero = next.slides[3];
  assert.ok(hero.block === "hero" && before.block === "hero");
  assert.ok(hero.headline.length <= before.headline.length);
  assert.ok(before.headline.startsWith(hero.headline.split(" ")[0]));
  assert.ok(validateDeck(next).ok);
});

test("targeted: remove with no field deletes the slide", () => {
  const next = reviseDeck(galleryDeck, "remove this slide", { slide: 2 });
  assert.equal(next.slides.length, galleryDeck.slides.length - 1);
  assert.equal(next.slides[1], galleryDeck.slides[2]);
  assert.ok(validateDeck(next).ok);
});

test("targeted: add appends to a list field", () => {
  const before = galleryDeck.slides[7];
  assert.ok(before.block === "content");
  const next = reviseDeck(galleryDeck, "add a bullet about offline support", {
    slide: 8,
    field: "bullets",
  });
  const after = next.slides[7];
  assert.ok(after.block === "content" && after.bullets.length > before.bullets.length);
  assert.ok(validateDeck(next).ok);
});

test("targeted: a multi-selection revises every target, rest untouched", () => {
  const next = reviseDeck(galleryDeck, 'change it to "Privacy wins."', [
    { slide: 4, field: "headline" },
    { slide: 9, field: "text" },
  ]);
  const hero = next.slides[3];
  const quote = next.slides[8];
  assert.equal(hero.block === "hero" && hero.headline, "Privacy wins.");
  assert.equal(quote.block === "quote" && quote.text, "Privacy wins.");
  for (let i = 0; i < next.slides.length; i++) {
    if (i !== 3 && i !== 8) assert.equal(next.slides[i], galleryDeck.slides[i]);
  }
  assert.ok(validateDeck(next).ok);
});

test("targeted: multi-remove deletes both slides despite index shifts", () => {
  const next = reviseDeck(galleryDeck, "remove these slides", [{ slide: 2 }, { slide: 9 }]);
  assert.equal(next.slides.length, galleryDeck.slides.length - 2);
  // Slides 2 (agenda) and 9 (quote) gone; neighbours intact.
  assert.equal(next.slides[1], galleryDeck.slides[2]);
  assert.equal(next.slides[7], galleryDeck.slides[9]);
  assert.ok(validateDeck(next).ok);
});

test("sanitizeTargets dedupes, clamps and orders a mixed list", () => {
  assert.deepEqual(
    sanitizeTargets(
      [{ slide: 9 }, { slide: 4, field: "headline" }, { slide: 9 }, { slide: 99 }],
      galleryDeck
    ),
    [{ slide: 4, field: "headline" }, { slide: 9, field: undefined }]
  );
});

test("sanitizeTarget clamps slide range and unknown fields", () => {
  assert.deepEqual(sanitizeTarget({ slide: 4, field: "headline" }, galleryDeck), {
    slide: 4,
    field: "headline",
  });
  // An unknown field for the block is dropped, the slide kept.
  assert.deepEqual(sanitizeTarget({ slide: 4, field: "bogus" }, galleryDeck), {
    slide: 4,
    field: undefined,
  });
  assert.equal(sanitizeTarget({ slide: 99 }, galleryDeck), null);
  assert.equal(sanitizeTarget({ slide: 0 }, galleryDeck), null);
  assert.equal(sanitizeTarget("nope", galleryDeck), null);
});

process.stdout.write("clamp\n");
test("clampDeck trims runaway slides and bullets", () => {
  const fat: DeckSpec = {
    title: "Fat",
    theme: "mind",
    slides: Array.from({ length: 30 }, (_, i) => ({
      block: "content" as const,
      title: `S${i}`,
      bullets: Array.from({ length: 12 }, (_, j) => `b${j}`),
    })),
  };
  const clamped = clampDeck(deckSchema.parse(fat));
  assert.equal(clamped.slides.length, 24);
  for (const s of clamped.slides) {
    if (s.block === "content") assert.ok(s.bullets.length <= 6);
  }
});

test("validateDeck reports a readable path on bad input", () => {
  const res = validateDeck({ title: "x", theme: "mind", slides: [{ block: "hero" }] });
  assert.ok(!res.ok);
  assert.ok(!res.ok && res.error.includes("slides.0"));
});

process.stdout.write("pod helpers\n");
test("podRootFromWebId strips the profile document", () => {
  assert.equal(
    podRootFromWebId("http://localhost:3102/alice/profile/card#me"),
    "http://localhost:3102/alice/"
  );
  assert.equal(
    decksContainerFor("http://localhost:3102/alice/"),
    "http://localhost:3102/alice/mind-slides/decks/"
  );
});

test("deckId slugs are url-safe and salted", () => {
  assert.equal(deckId("Hello, World! — deck", "123456"), "hello-world-deck-123456");
  assert.equal(deckId("???", "42"), "deck-42");
});

process.stdout.write("free-allotment policy\n");
const byok = { provider: "openrouter" as const, apiKey: "or-key" };

test("BYOK wins outright and is never metered", () => {
  const c = chooseGenerationPath({
    ledgerEnabled: true,
    webid: "https://pods/u#me",
    byok,
    companyProvider: "anthropic",
    balance: 0,
  });
  assert.deepEqual(c, { kind: "byok", provider: "openrouter", apiKey: "or-key" });
});

test("no company key → offline composer", () => {
  const c = chooseGenerationPath({
    ledgerEnabled: false,
    webid: null,
    byok: null,
    companyProvider: null,
    balance: null,
  });
  assert.deepEqual(c, { kind: "offline" });
});

test("ledger off → company key, unmetered (today's behavior)", () => {
  const c = chooseGenerationPath({
    ledgerEnabled: false,
    webid: "https://pods/u#me",
    byok: null,
    companyProvider: "anthropic",
    balance: null,
  });
  assert.deepEqual(c, { kind: "company", meter: false });
});

test("ledger on but anonymous → offline (don't spend company funds)", () => {
  const c = chooseGenerationPath({
    ledgerEnabled: true,
    webid: null,
    byok: null,
    companyProvider: "anthropic",
    balance: null,
  });
  assert.deepEqual(c, { kind: "offline" });
});

test("ledger on, known user, spent → out_of_free", () => {
  const c = chooseGenerationPath({
    ledgerEnabled: true,
    webid: "https://pods/u#me",
    byok: null,
    companyProvider: "anthropic",
    balance: 0,
  });
  assert.deepEqual(c, { kind: "out_of_free", balance: 0 });
});

test("ledger on, known user, has balance → company key, metered", () => {
  const c = chooseGenerationPath({
    ledgerEnabled: true,
    webid: "https://pods/u#me",
    byok: null,
    companyProvider: "openrouter",
    balance: 42,
  });
  assert.deepEqual(c, { kind: "company", meter: true });
});

test("ledger reachable-unknown balance fails open → metered company key", () => {
  const c = chooseGenerationPath({
    ledgerEnabled: true,
    webid: "https://pods/u#me",
    byok: null,
    companyProvider: "anthropic",
    balance: null,
  });
  assert.deepEqual(c, { kind: "company", meter: true });
});

test("inferProvider distinguishes Anthropic from OpenRouter keys", () => {
  assert.equal(inferProvider("sk-ant-abc"), "anthropic");
  assert.equal(inferProvider("sk-or-v1-abc"), "openrouter");
});

process.stdout.write(
  process.exitCode ? `\n${passed} passed, with failures\n` : `\n✓ all ${passed} checks passed\n`
);
