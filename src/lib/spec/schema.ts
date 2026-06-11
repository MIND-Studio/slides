import { z } from "zod";

/**
 * The DeckSpec is the ONLY contract an agent (or the chat UI) ever touches.
 * Every field is constrained; there is no free-form CSS/JS/HTML escape hatch.
 * `serialize.ts` is the single path from a validated DeckSpec to Slidev
 * Markdown, so a well-typed spec can only ever produce one of our controlled
 * block layouts.
 *
 * Schema design rules (so it round-trips through Anthropic structured outputs /
 * `zodOutputFormat` without unsupported-keyword errors):
 *   - discriminated union on `block` (no recursion)
 *   - no string length / numeric range keywords in the emitted JSON schema —
 *     soft bounds are enforced afterwards in `clampDeck` / friendly validation
 *   - every object is closed (zod objects are strict via `.strict()` below)
 */

export const THEMES = ["mind", "arctic"] as const;
export type ThemeName = (typeof THEMES)[number];

// ---- shared sub-shapes ------------------------------------------------------

const column = z
  .object({
    heading: z.string().describe("Short column heading, e.g. 'Today' or 'Cloud'"),
    points: z.array(z.string()).describe("2–5 short bullet points for this column"),
  })
  .strict();

const timelineItem = z
  .object({
    date: z.string().describe("Short date or phase label, e.g. '2024' or 'Q1'"),
    label: z.string().describe("What happened — one short line"),
  })
  .strict();

// ---- the controlled block set ----------------------------------------------

const titleSlide = z
  .object({
    block: z.literal("title"),
    kicker: z.string().optional().describe("Tiny uppercase eyebrow above the title"),
    title: z.string().describe("The deck / opening title"),
    subtitle: z.string().optional().describe("One supporting line under the title"),
  })
  .strict();

const sectionSlide = z
  .object({
    block: z.literal("section"),
    kicker: z.string().optional().describe("Section number or eyebrow, e.g. 'Part 02'"),
    title: z.string().describe("The section name — a cinematic divider"),
    note: z.string().optional().describe("Optional one-line framing for the section"),
  })
  .strict();

const heroSlide = z
  .object({
    block: z.literal("hero"),
    kicker: z.string().optional(),
    headline: z.string().describe("A bold, large statement — the single idea of the slide"),
    sub: z.string().optional().describe("Supporting sentence under the headline"),
    cta: z.string().optional().describe("Optional call-to-action line"),
  })
  .strict();

const bigNumberSlide = z
  .object({
    block: z.literal("bigNumber"),
    value: z.string().describe("The headline figure, e.g. '98%', '3.2x', '$1.4M'"),
    label: z.string().describe("What the number measures — short"),
    caption: z.string().optional().describe("Optional context line under the label"),
  })
  .strict();

const comparisonSlide = z
  .object({
    block: z.literal("comparison"),
    title: z.string().optional(),
    left: column,
    right: column,
  })
  .strict();

const quoteSlide = z
  .object({
    block: z.literal("quote"),
    text: z.string().describe("The quotation, without surrounding quote marks"),
    attribution: z.string().optional().describe("Who said it, e.g. 'Ada Lovelace, 1843'"),
  })
  .strict();

const imageFocusSlide = z
  .object({
    block: z.literal("imageFocus"),
    title: z.string().optional(),
    image: z.string().describe("Absolute https URL of the image to feature"),
    caption: z.string().optional(),
  })
  .strict();

const timelineSlide = z
  .object({
    block: z.literal("timeline"),
    title: z.string().optional(),
    items: z.array(timelineItem).describe("3–6 chronological steps"),
  })
  .strict();

const agendaSlide = z
  .object({
    block: z.literal("agenda"),
    title: z.string().optional().describe("Defaults to 'Agenda' when omitted"),
    items: z.array(z.string()).describe("3–6 agenda lines"),
  })
  .strict();

const contentSlide = z
  .object({
    block: z.literal("content"),
    kicker: z.string().optional(),
    title: z.string().describe("Slide title"),
    bullets: z.array(z.string()).describe("2–6 concise bullet points"),
  })
  .strict();

export const slideSchema = z.discriminatedUnion("block", [
  titleSlide,
  sectionSlide,
  heroSlide,
  bigNumberSlide,
  comparisonSlide,
  quoteSlide,
  imageFocusSlide,
  timelineSlide,
  agendaSlide,
  contentSlide,
]);

export const deckSchema = z
  .object({
    title: z.string().describe("Deck title — used for the pod filename and tab"),
    theme: z.enum(THEMES).describe("Visual palette; both reskin the same blocks"),
    slides: z.array(slideSchema).describe("The ordered slides, 1–24"),
  })
  .strict();

export type Slide = z.infer<typeof slideSchema>;
export type DeckSpec = z.infer<typeof deckSchema>;
export type BlockName = Slide["block"];

export const BLOCK_NAMES: BlockName[] = [
  "title",
  "section",
  "hero",
  "bigNumber",
  "comparison",
  "quote",
  "imageFocus",
  "timeline",
  "agenda",
  "content",
];
