import type { BlockName, DeckSpec } from "./schema";

/**
 * An edit selection: "slide 3" or "slide 3, the headline". This is how the
 * studio points at content without describing it in prose — the inspector,
 * the preview's click-to-select, and the scoped AI refine all speak this one
 * shape. `slide` is 1-based everywhere (UI, API body, iframe postMessage),
 * matching the number the user sees in the badge and in Slidev's nav.
 */
export interface EditTarget {
  slide: number;
  field?: string;
}

export type FieldKind = "text" | "lines" | "column" | "timeline";

export interface FieldDef {
  key: string;
  kind: FieldKind;
  optional?: boolean;
}

/**
 * The editable fields of each block, in display order — the inspector's form
 * catalog and the reviser's field map. Mirrors `schema.ts` exactly; a field
 * added there must be added here to be selectable.
 */
export const BLOCK_FIELDS: Record<BlockName, FieldDef[]> = {
  title: [
    { key: "kicker", kind: "text", optional: true },
    { key: "title", kind: "text" },
    { key: "subtitle", kind: "text", optional: true },
  ],
  section: [
    { key: "kicker", kind: "text", optional: true },
    { key: "title", kind: "text" },
    { key: "note", kind: "text", optional: true },
  ],
  hero: [
    { key: "kicker", kind: "text", optional: true },
    { key: "headline", kind: "text" },
    { key: "sub", kind: "text", optional: true },
    { key: "cta", kind: "text", optional: true },
  ],
  bigNumber: [
    { key: "value", kind: "text" },
    { key: "label", kind: "text" },
    { key: "caption", kind: "text", optional: true },
  ],
  comparison: [
    { key: "title", kind: "text", optional: true },
    { key: "left", kind: "column" },
    { key: "right", kind: "column" },
  ],
  quote: [
    { key: "text", kind: "text" },
    { key: "attribution", kind: "text", optional: true },
  ],
  imageFocus: [
    { key: "title", kind: "text", optional: true },
    { key: "image", kind: "text" },
    { key: "caption", kind: "text", optional: true },
  ],
  timeline: [
    { key: "title", kind: "text", optional: true },
    { key: "items", kind: "timeline" },
  ],
  agenda: [
    { key: "title", kind: "text", optional: true },
    { key: "items", kind: "lines" },
  ],
  content: [
    { key: "kicker", kind: "text", optional: true },
    { key: "title", kind: "text" },
    { key: "bullets", kind: "lines" },
  ],
};

/** "slide 3 (hero block), its "headline" field" — for prompts and chips. */
export function describeTarget(target: EditTarget, deck: DeckSpec): string {
  const slide = deck.slides[target.slide - 1];
  const block = slide ? ` (${slide.block} block)` : "";
  const field = target.field ? `, its "${target.field}" field` : "";
  return `slide ${target.slide}${block}${field}`;
}

/** Multi-select: "slides 2, 4 (and slide 2's headline)" — for prompts. */
export function describeTargets(targets: EditTarget[], deck: DeckSpec): string {
  return targets.map((t) => describeTarget(t, deck)).join("; ");
}

/** One target or a list → a deduped, slide-ordered, clamped list. */
export function sanitizeTargets(raw: unknown, deck: DeckSpec, max = 12): EditTarget[] {
  const list = Array.isArray(raw) ? raw : [raw];
  const out: EditTarget[] = [];
  for (const item of list) {
    const t = sanitizeTarget(item, deck);
    if (t && !out.some((x) => x.slide === t.slide && x.field === t.field)) out.push(t);
    if (out.length >= max) break;
  }
  return out.sort((a, b) => a.slide - b.slide);
}

/** Clamp an untrusted target against a deck; null when out of range. */
export function sanitizeTarget(raw: unknown, deck: DeckSpec): EditTarget | null {
  if (!raw || typeof raw !== "object") return null;
  const slide = Number((raw as { slide?: unknown }).slide);
  if (!Number.isInteger(slide) || slide < 1 || slide > deck.slides.length) return null;
  const fieldRaw = (raw as { field?: unknown }).field;
  const block = deck.slides[slide - 1].block;
  const field =
    typeof fieldRaw === "string" && BLOCK_FIELDS[block].some((f) => f.key === fieldRaw)
      ? fieldRaw
      : undefined;
  return { slide, field };
}
