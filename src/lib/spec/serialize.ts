import type { DeckSpec, Slide, ThemeName } from "./schema";

/**
 * The single, pure path from a validated DeckSpec to Slidev Markdown.
 *
 * Every block's data is handed to its Vue layout through ONE namespaced
 * frontmatter key — `data` — read as `$frontmatter.data` inside the layout.
 * Namespacing matters: block fields like `title`/`class`/`transition` would
 * otherwise collide with Slidev's reserved frontmatter keys (and with the
 * deck-level `title` in the headmatter) and silently clobber each other.
 *
 * We encode the value with `JSON.stringify` — JSON is a subset of YAML, so
 * strings are safely quoted/escaped and nested arrays/objects serialize as
 * valid YAML flow style with zero bespoke escaping. This is what makes the
 * "agent can't inject arbitrary CSS/JS" guarantee hold: only structured data
 * ever reaches a fixed layout.
 */

function yamlLine(key: string, value: unknown): string {
  return `${key}: ${JSON.stringify(value)}`;
}

/** The data payload for a slide = all block fields except the discriminant. */
function dataOf(slide: Slide): Record<string, unknown> {
  const { block: _block, ...rest } = slide;
  return rest;
}

/**
 * A short title for Slidev's nav / overview / TOC. Our content lives in `data`,
 * not as Markdown headings, so without this Slidev shows "undefined" per slide.
 * This is the reserved top-level `title` frontmatter key (distinct from
 * `data.title`, which the layout renders).
 */
export function navTitleOf(slide: Slide): string {
  switch (slide.block) {
    case "title":
    case "section":
    case "content":
      return slide.title;
    case "hero":
      return slide.headline;
    case "bigNumber":
      return `${slide.value} · ${slide.label}`;
    case "quote":
      return slide.attribution ?? "Quote";
    case "comparison":
      return slide.title ?? `${slide.left.heading} vs ${slide.right.heading}`;
    case "imageFocus":
      return slide.title ?? "Image";
    case "timeline":
      return slide.title ?? "Timeline";
    case "agenda":
      return slide.title ?? "Agenda";
  }
}

/**
 * Frontmatter lines for one slide: layout, palette class, namespaced data, and
 * (for slides after the first) a nav title. The first slide is skipped because
 * its title is the deck-level `title` already in the headmatter — emitting it
 * again would be a duplicate YAML key.
 */
function frontmatterFor(slide: Slide, theme: ThemeName, withTitle: boolean): string[] {
  const lines = [
    yamlLine("layout", slide.block),
    yamlLine("class", `palette-${theme}`),
    yamlLine("data", dataOf(slide)),
  ];
  if (withTitle) lines.unshift(yamlLine("title", navTitleOf(slide)));
  return lines;
}

/**
 * Markdown body for a slide. Layouts render structured data from frontmatter,
 * so most bodies are empty. The `content` block is the exception: its bullets
 * become a real Markdown list so Slidev styles them (the layout renders the
 * default `<slot/>`).
 */
function bodyFor(slide: Slide): string {
  if (slide.block === "content") {
    return slide.bullets.map((b) => `- ${b}`).join("\n");
  }
  return "";
}

export function serializeDeck(deck: DeckSpec): string {
  const first = deck.slides[0];
  const blocks: string[] = [];

  // Headmatter = global Slidev config merged into slide 1's frontmatter, in a
  // single block (Slidev's first frontmatter is both deck config and slide 1).
  const head = [
    yamlLine("theme", "default"),
    yamlLine("title", deck.title),
    yamlLine("colorSchema", "dark"),
    yamlLine("transition", "slide-left"),
    yamlLine("mdc", true),
    ...frontmatterFor(first, deck.theme, false),
  ];
  blocks.push(`---\n${head.join("\n")}\n---\n\n${bodyFor(first)}`.trimEnd());

  for (const slide of deck.slides.slice(1)) {
    const fm = frontmatterFor(slide, deck.theme, true).join("\n");
    blocks.push(`---\n${fm}\n---\n\n${bodyFor(slide)}`.trimEnd());
  }

  return blocks.join("\n\n") + "\n";
}
