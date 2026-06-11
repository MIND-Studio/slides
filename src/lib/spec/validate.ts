import { deckSchema, type DeckSpec } from "./schema";

export type ValidateResult =
  | { ok: true; deck: DeckSpec }
  | { ok: false; error: string };

/**
 * Parse unknown JSON into a DeckSpec with a human-readable error suitable for
 * surfacing in the chat UI (not a raw Zod dump). Used to re-validate whatever
 * the model returns before we ever trust it / serialize it.
 */
export function validateDeck(input: unknown): ValidateResult {
  const parsed = deckSchema.safeParse(input);
  if (parsed.success) return { ok: true, deck: clampDeck(parsed.data) };

  const first = parsed.error.issues[0];
  const path = first?.path.join(".") || "(root)";
  return {
    ok: false,
    error: `Invalid deck spec at ${path}: ${first?.message ?? "unknown error"}`,
  };
}

/**
 * Soft bounds enforced AFTER schema parse (kept out of the JSON schema so the
 * structured-output request stays portable). Trims a runaway model to sane
 * limits rather than rejecting — the deck still renders.
 */
export function clampDeck(deck: DeckSpec): DeckSpec {
  const slides = deck.slides.slice(0, 24).map((slide) => {
    switch (slide.block) {
      case "content":
        return { ...slide, bullets: slide.bullets.slice(0, 6) };
      case "agenda":
        return { ...slide, items: slide.items.slice(0, 6) };
      case "timeline":
        return { ...slide, items: slide.items.slice(0, 6) };
      case "comparison":
        return {
          ...slide,
          left: { ...slide.left, points: slide.left.points.slice(0, 5) },
          right: { ...slide.right, points: slide.right.points.slice(0, 5) },
        };
      default:
        return slide;
    }
  });
  return { ...deck, slides: slides.length ? slides : deck.slides };
}
