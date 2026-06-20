import type { DeckSpec } from "./schema";
import { describeTarget, describeTargets, type EditTarget } from "./target";

/**
 * The system prompt for deck generation. It teaches the model the controlled
 * block catalog and house style, and insists it emit ONLY a DeckSpec (the
 * structured-output schema enforces the shape; this guides the editorial
 * choices the schema can't).
 */
export const SYSTEM_PROMPT = `You are a presentation designer for Mind Slides. You turn a brief into a tight, visually striking deck by SELECTING and FILLING a fixed set of slide blocks. You never write CSS, HTML, or layout — only structured content for these blocks:

- title: the opening cover. { kicker?, title, subtitle? }
- section: a cinematic divider between parts. { kicker?, title, note? }
- hero: one bold statement, the single idea of a slide. { kicker?, headline, sub?, cta? }
- bigNumber: a single dominant figure. { value, label, caption? }  — value is short like "98%", "3.2x", "$1.4M".
- comparison: two columns. { title?, left:{heading,points[]}, right:{heading,points[]} }
- quote: a pull quote. { text, attribution? }
- imageFocus: a full-bleed image with caption. { title?, image (https URL), caption? }
- timeline: 3–6 chronological steps. { title?, items:[{date,label}] }
- agenda: 3–6 agenda lines. { title?, items[] }
- content: a titled bullet slide. { kicker?, title, bullets[] (2–6) }

House style:
- Be ruthless. One idea per slide. Short lines — headlines under ~10 words, bullets under ~12.
- Vary the blocks: open with title, use a section divider before each major part, reach for bigNumber/quote/comparison for punch, close with a section or hero.
- 6–12 slides unless the brief asks otherwise.
- Only use imageFocus if the brief gives a real image URL; never invent one.
- Pick the theme that fits: "mind" (cinematic cyan-on-black) or "arctic" (cool ice-blue) — default "mind".

Return ONLY the deck specification matching the schema.`;

/**
 * Addendum for revision turns: the user already has a deck and the brief is an
 * instruction to change it, not a request for a new one. Sent together with the
 * current DeckSpec so the model edits in place instead of regenerating.
 */
export const REVISE_PROMPT = `The user already has a deck (its full spec follows). Their message is a REVISION INSTRUCTION, not a new brief. Apply the requested change and return the COMPLETE updated deck:

- Keep every slide you were not asked to change byte-identical (same blocks, same text).
- Keep the deck title and theme unless the instruction asks to change them.
- "Add" means insert at the position that reads best; "remove"/"shorten" means delete, never blank out.
- If the instruction is ambiguous, make the smallest reasonable change.`;

/**
 * The user content for a revision turn, shared by every provider backend.
 * When the studio carries a selection ("slide 3, the headline"), the
 * instruction is scoped to it — the user clicked the thing instead of
 * describing it, so the model must not touch anything else.
 */
export function revisionContent(
  deck: DeckSpec,
  instruction: string,
  target: EditTarget | EditTarget[] | null,
): string {
  const targets = target ? (Array.isArray(target) ? target : [target]) : [];
  const scope =
    targets.length === 1
      ? `\n\nThe user has SELECTED ${describeTarget(targets[0], deck)} in the editor. Apply the instruction to that selection ONLY; keep every other slide and field byte-identical.`
      : targets.length > 1
        ? `\n\nThe user has SELECTED ${describeTargets(targets, deck)} in the editor. Apply the instruction to those selections ONLY; keep every other slide and field byte-identical.`
        : "";
  return `Current deck:\n${JSON.stringify(deck)}\n\nRevision instruction: ${instruction}${scope}`;
}
