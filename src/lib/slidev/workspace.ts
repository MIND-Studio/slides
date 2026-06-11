import { promises as fs } from "fs";
import path from "path";
import type { DeckSpec } from "@/lib/spec/schema";
import { serializeDeck } from "@/lib/spec/serialize";

/**
 * The render bridge. Slidev runs as a separate Vite/Vue sidecar (`npm run
 * slidev`, port 3101) serving ONE entry file: `slidev/slides.md`. The Next app
 * never embeds Slidev in-process — it can't (different bundler, different
 * runtime). Instead, making a deck "active" means writing its serialized
 * Markdown over that single file; Slidev's HMR then repaints the iframe.
 *
 * v0 limitation (documented in AGENTS.md): one active deck at a time, single
 * local user. Concurrent multi-deck rendering is explicit later work.
 */
// Overridable for containerized deployments, where the Next server and the
// Slidev sidecar share the active file through a mounted volume.
const SLIDES_PATH =
  process.env.SLIDES_PATH ?? path.join(process.cwd(), "slidev", "slides.md");

export async function setActiveDeck(deck: DeckSpec): Promise<string> {
  const markdown = serializeDeck(deck);
  await fs.writeFile(SLIDES_PATH, markdown, "utf8");
  return markdown;
}

export async function readActiveMarkdown(): Promise<string> {
  try {
    return await fs.readFile(SLIDES_PATH, "utf8");
  } catch {
    return "";
  }
}
