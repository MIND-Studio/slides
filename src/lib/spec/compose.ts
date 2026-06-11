import { THEMES, type DeckSpec, type Slide, type ThemeName } from "./schema";
import { BLOCK_FIELDS, type EditTarget } from "./target";

/**
 * Deterministic, offline DeckSpec composer.
 *
 * This is the fallback the generation route uses when `ANTHROPIC_API_KEY` is
 * not set, so the full brief → spec → render loop is demonstrable without a
 * live model. It is intentionally simple — it does NOT try to be the LLM. It
 * mines the brief for a title, a number, and a handful of points, then assembles
 * a valid, varied deck out of the controlled blocks. The output goes through the
 * exact same `validateDeck` + `serializeDeck` path as a real generation, so the
 * "controlled blocks only" guarantee is identical.
 */

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstSentence(brief: string): string {
  const m = brief.trim().match(/^[^.!?\n]+/);
  return (m?.[0] ?? brief).trim();
}

/** Pull short, punchy phrases to use as bullets / agenda items. */
function extractPoints(brief: string): string[] {
  const parts = brief
    .split(/[\n;.]|,\s+(?:and|or)\s+|\s+[•\-–]\s+/)
    // A clause over the length cap is usually a comma-chained list ("open with
    // a hero, show a big number, compare us to X") — split it further rather
    // than dropping it wholesale and mining nothing from the brief.
    .flatMap((p) => (p.trim().length > 80 ? p.split(/,\s+/) : [p]))
    .map((p) => p.replace(/^[\s•\-–*\d.)]+/, "").trim())
    .filter((p) => p.length >= 3 && p.length <= 80);
  // De-dupe, keep order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p.charAt(0).toUpperCase() + p.slice(1));
    }
  }
  return out;
}

interface Figure {
  value: string;
  label: string;
}

function findNumber(brief: string): Figure | null {
  const matches = [
    // Unit alternation is longest-match-first: a bare `m`/`k` must come AFTER
    // `million`/`billion`, or "2 million" matches just the `m` ("2 m") and
    // orphans "illion" into the label.
    ...brief.matchAll(/\$?\d[\d,]*\.?\d*\s*(?:billion|million|bn|m|k|x|%)?/gi),
  ]
    .map((m) => ({ text: m[0].trim(), index: m.index ?? 0 }))
    // Drop slide-count mentions like "5-slide" / "5 slides".
    .filter((m) => !/^\s*-?\s*slides?\b/i.test(brief.slice(m.index + m.text.length)));
  if (matches.length === 0) return null;

  // Prefer a figure carrying a unit (98%, 3.2x, $1.4M); else the largest.
  const withUnit = matches.find((m) => /[%xkmbn$]/i.test(m.text));
  const chosen =
    withUnit ??
    matches.sort(
      (a, b) =>
        Number(b.text.replace(/[^\d.]/g, "")) - Number(a.text.replace(/[^\d.]/g, ""))
    )[0];

  // Grab up to three trailing words as a label ("50000 active users" → "active users").
  const after = brief.slice(chosen.index + chosen.text.length).trim();
  const words = after.match(/^([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,2})/i);
  const label = words ? words[1].replace(/\b(and|the|of|a|an)$/i, "").trim() : "";
  return { value: chosen.text, label: label || "the number that matters" };
}

function deriveTitle(brief: string): string {
  // "a pitch for Helix, a privacy-first..." → "Helix". Pull the subject after
  // a pitch/deck/presentation cue when there is one.
  const subject = brief.match(
    /\b(?:pitch|deck|presentation|talk|slides?)\s+(?:for|about|on|introducing)\s+([A-Z][\w&-]*(?:\s+[A-Z][\w&-]*)?)/
  );
  if (subject) return subject[1].trim();

  const s = firstSentence(brief).replace(
    /^(make|build|create|design|a|an|the)\s+/i,
    ""
  );
  const trimmed = s.length > 56 ? s.slice(0, 53).trimEnd() + "…" : s;
  return titleCase(trimmed) || "New deck";
}

export function composeDeck(brief: string, theme: ThemeName): DeckSpec {
  const title = deriveTitle(brief);
  const points = extractPoints(brief);
  const number = findNumber(brief);

  const slides: Slide[] = [];

  slides.push({
    block: "title",
    kicker: "Mind Slides",
    title,
    subtitle: firstSentence(brief).slice(0, 110),
  });

  if (points.length >= 3) {
    slides.push({ block: "agenda", items: points.slice(0, 4) });
  }

  slides.push({
    block: "hero",
    kicker: "The idea",
    headline: title,
    sub: brief.trim().slice(0, 160),
  });

  if (number) {
    slides.push({
      block: "bigNumber",
      value: number.value,
      label: number.label,
      caption: firstSentence(brief).slice(0, 90),
    });
  }

  if (points.length >= 2) {
    slides.push({
      block: "content",
      kicker: "Details",
      title: "What it covers",
      bullets: points.slice(0, 6),
    });
  }

  if (points.length >= 4) {
    slides.push({
      block: "comparison",
      title: "Before and after",
      left: { heading: "Before", points: points.slice(0, 2) },
      right: { heading: "After", points: points.slice(2, 4) },
    });
  }

  slides.push({ block: "section", kicker: "End", title: "Thank you." });

  return { title, theme, slides };
}

/**
 * Offline TARGETED revision — the user selected a slide (or a field on it) in
 * the studio instead of describing it. Deterministic, so deliberately literal:
 *
 * - "remove"/"delete" with no field selected → remove the slide.
 * - a quoted value (or `... to X`) → set the selected field to it.
 * - "shorter"/"punchier" on a text field → truncate at the first clause break.
 * - list fields (bullets/items/points): "add ..." appends mined points;
 *   otherwise mined points replace the list when there are enough of them.
 * - fallback: set the field to the instruction's first sentence, stripped of a
 *   leading imperative ("change it to", "say", ...), so the loop always
 *   visibly applies to the selection.
 *
 * Only the targeted slide is ever touched — everything else is structurally
 * shared with the input deck.
 */
function reviseTargeted(deck: DeckSpec, instruction: string, target: EditTarget): DeckSpec {
  const idx = target.slide - 1;
  const slide = deck.slides[idx];
  const lower = instruction.toLowerCase();

  if (!target.field && /\b(remove|delete|drop)\b/.test(lower) && deck.slides.length > 1) {
    const slides = [...deck.slides];
    slides.splice(idx, 1);
    return { ...deck, slides };
  }

  // The selected field, or the block's primary required text field.
  const fields = BLOCK_FIELDS[slide.block];
  const def =
    (target.field && fields.find((f) => f.key === target.field)) ||
    fields.find((f) => f.kind === "text" && !f.optional) ||
    fields[0];

  const record = slide as unknown as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };

  const quoted =
    instruction.match(/["“']([^"”']{2,120})["”']/)?.[1] ??
    instruction.match(/\bto:?\s+(.{2,120}?)[.!?]?\s*$/i)?.[1];

  if (def.kind === "text") {
    const current = typeof record[def.key] === "string" ? (record[def.key] as string) : "";
    if (quoted) {
      next[def.key] = quoted.trim();
    } else if (/\b(shorter|shorten|tighten|punchier|punchy|crisper)\b/.test(lower) && current) {
      const clause = current.split(/[,—–:;]/)[0].trim();
      next[def.key] = (clause.length >= 3 ? clause : current.split(/\s+/).slice(0, 6).join(" "))
        .replace(/[\s.]+$/, "");
    } else if (/\b(remove|delete|drop|clear)\b/.test(lower) && def.optional) {
      delete next[def.key];
    } else {
      const mined = firstSentence(instruction).replace(
        /^(change|make|set|update|rewrite|say|use)\b[^:]*?(?:to|:)?\s*/i,
        ""
      );
      next[def.key] = (mined || instruction).trim().slice(0, 110);
    }
  } else if (def.kind === "lines") {
    const current = Array.isArray(record[def.key]) ? (record[def.key] as string[]) : [];
    const mined = quoted ? [quoted.trim()] : extractPoints(instruction);
    if (/\b(add|insert|include|append)\b/.test(lower)) {
      next[def.key] = [...current, ...(mined.length ? mined.slice(0, 3) : [instruction.trim().slice(0, 80)])];
    } else {
      next[def.key] = mined.length >= 2 ? mined.slice(0, 6) : [...current, ...mined];
    }
  } else if (def.kind === "column") {
    const current = record[def.key] as { heading: string; points: string[] };
    const mined = extractPoints(instruction);
    next[def.key] = {
      heading: quoted?.trim() ?? current.heading,
      points: !quoted && mined.length >= 2 ? mined.slice(0, 5) : current.points,
    };
  } else {
    // timeline — mine "date — label" / "date: label" lines from the instruction.
    const current = Array.isArray(record[def.key])
      ? (record[def.key] as { date: string; label: string }[])
      : [];
    const mined = extractPoints(instruction)
      .map((p) => p.match(/^(.{1,16}?)\s*[—–:|-]\s+(.+)$/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map((m) => ({ date: m[1].trim(), label: m[2].trim() }));
    if (mined.length) {
      next[def.key] = /\b(add|insert|include|append)\b/.test(lower)
        ? [...current, ...mined]
        : mined;
    }
  }

  const slides = [...deck.slides];
  slides[idx] = next as unknown as Slide;
  return { ...deck, slides };
}

/**
 * Deterministic, offline deck REVISER — the no-key counterpart of the model's
 * revision turn. It interprets a handful of unambiguous instruction shapes and
 * otherwise appends a content slide mined from the instruction, so the refine
 * loop always visibly does something without an API key. Same validate +
 * serialize path as everything else.
 */
export function reviseDeck(
  deck: DeckSpec,
  instruction: string,
  target?: EditTarget | EditTarget[] | null
): DeckSpec {
  // Multi-select: fold the targeted reviser over each selection, highest
  // slide first so a "remove" doesn't shift the indexes still to be visited.
  const targets = (Array.isArray(target) ? target : target ? [target] : []).filter(
    (t) => t.slide >= 1 && t.slide <= deck.slides.length
  );
  if (targets.length > 0) {
    return [...targets]
      .sort((a, b) => b.slide - a.slide)
      .reduce((d, t) => (t.slide <= d.slides.length ? reviseTargeted(d, instruction, t) : d), deck);
  }
  const lower = instruction.toLowerCase();
  let slides: Slide[] = [...deck.slides];
  let { title, theme } = deck;

  // Theme switch: "make it arctic", "switch to mind theme".
  const themeAsk = THEMES.find((t) => lower.includes(t));
  if (themeAsk && /\b(theme|palette|look|style|switch|make it)\b/.test(lower)) {
    theme = themeAsk;
  }

  // Retitle: rename/retitle the deck to "X" / call it X.
  const retitle = instruction.match(
    /\b(?:rename|retitle|call)\s+(?:it|the deck|this)?\s*(?:to|as)?\s*["“']?([^"”'\n.]{2,60})["”']?/i
  );
  if (retitle) title = retitle[1].trim();

  // Remove slide N (1-based, as shown in the studio badge / Slidev nav).
  const removal = lower.match(/\b(?:remove|delete|drop)\s+slide\s+(\d{1,2})\b/);
  if (removal) {
    const idx = Number(removal[1]) - 1;
    if (idx >= 0 && idx < slides.length && slides.length > 1) {
      slides.splice(idx, 1);
    }
  }

  // Shorten: keep the opening + the strongest middle + the closer.
  if (/\b(shorter|shorten|fewer slides|trim|tighten|condense)\b/.test(lower)) {
    if (slides.length > 5) {
      slides = [...slides.slice(0, 4), slides[slides.length - 1]];
    }
  }

  // Add: "add a quote ...", "add a slide about X" → mine the instruction.
  const addAsk = /\b(add|insert|include|append)\b/.test(lower);
  const changedSoFar =
    theme !== deck.theme || title !== deck.title || slides.length !== deck.slides.length;
  if (addAsk || !changedSoFar) {
    const insertAt = Math.max(slides.length - 1, 0); // before the closer
    if (/\bquote\b/.test(lower)) {
      slides.splice(insertAt, 0, {
        block: "quote",
        text: firstSentence(instruction.replace(/.*quote[^:]*:?\s*/i, "")) || instruction.trim(),
      });
    } else {
      const number = findNumber(instruction);
      if (number) {
        slides.splice(insertAt, 0, {
          block: "bigNumber",
          value: number.value,
          label: number.label,
        });
      } else {
        const points = extractPoints(instruction);
        slides.splice(insertAt, 0, {
          block: "content",
          kicker: "Update",
          title: firstSentence(instruction).slice(0, 60) || "More",
          bullets: points.length >= 2 ? points.slice(0, 5) : [instruction.trim().slice(0, 80)],
        });
      }
    }
  }

  return { title, theme, slides };
}
