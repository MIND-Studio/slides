/**
 * Write a deck's serialized Markdown to `slidev/slides.md` (the sidecar's
 * single entry file). Defaults to the gallery deck — handy for booting the
 * Slidev sidecar with real content before any generation. Also doubles as the
 * serializer smoke check: it round-trips an example through `serializeDeck`.
 *
 *   tsx scripts/build-active.ts            # gallery
 *   tsx scripts/build-active.ts launch     # launchDeck
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { galleryDeck, launchDeck, reviewDeck } from "../src/lib/spec/examples";
import { serializeDeck } from "../src/lib/spec/serialize";
import { validateDeck } from "../src/lib/spec/validate";

const which = process.argv[2] ?? "gallery";
const deck =
  which === "launch" ? launchDeck : which === "review" ? reviewDeck : galleryDeck;

const check = validateDeck(deck);
if (!check.ok) {
  console.error(`Example deck failed validation: ${check.error}`);
  process.exit(1);
}

const md = serializeDeck(check.deck);
const out = join(process.cwd(), "slidev", "slides.md");
writeFileSync(out, md, "utf8");
process.stdout.write(`✓ Wrote ${deck.slides.length}-slide "${deck.title}" → slidev/slides.md\n`);
