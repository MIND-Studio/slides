import { NextRequest, NextResponse } from "next/server";
import { THEMES, type ThemeName, type DeckSpec, deckSchema } from "@/lib/spec/schema";
import { validateDeck } from "@/lib/spec/validate";
import { composeDeck, reviseDeck } from "@/lib/spec/compose";
import { SYSTEM_PROMPT, REVISE_PROMPT, revisionContent } from "@/lib/spec/prompt";
import { sanitizeTargets, type EditTarget } from "@/lib/spec/target";
import {
  generateWithOpenRouter,
  openRouterModel,
  OpenRouterError,
} from "@/lib/generate/openrouter";
import { setActiveDeck } from "@/lib/slidev/workspace";

// The Anthropic SDK + filesystem write need the Node runtime, not Edge.
export const runtime = "nodejs";

/** Hard input cap — a brief/instruction is a paragraph, not a document. */
const MAX_BRIEF_CHARS = 4000;

function pickTheme(input: unknown): ThemeName {
  return THEMES.includes(input as ThemeName) ? (input as ThemeName) : "mind";
}

type Provider = "anthropic" | "openrouter";

const ANTHROPIC_MODEL = "claude-opus-4-8";

/**
 * Which backend serves this request. GENERATION_PROVIDER pins one explicitly;
 * otherwise Anthropic wins when both keys are present (it's the first-party
 * structured-outputs path), and no key at all means the offline composer.
 */
function pickProvider(): Provider | { error: string } | null {
  const forced = process.env.GENERATION_PROVIDER;
  if (forced) {
    if (forced !== "anthropic" && forced !== "openrouter") {
      return { error: `Unknown GENERATION_PROVIDER "${forced}" (anthropic | openrouter)` };
    }
    const key = forced === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENROUTER_API_KEY";
    if (!process.env[key]) {
      return { error: `GENERATION_PROVIDER=${forced} but ${key} is not set` };
    }
    return forced;
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return null;
}

/**
 * Generate a deck from a natural-language brief — or REVISE the current deck
 * when the body carries `currentDeck` (the brief is then a revision
 * instruction).
 *
 * With a provider key set (Anthropic first-party, or any model via
 * OpenRouter): the model is constrained to our DeckSchema via structured
 * outputs, so it can only return a conforming spec. Without a key: a
 * deterministic local composer/reviser produces a valid spec, so the full
 * loop works offline. Either way the result is re-validated and made the
 * active deck (writes the Slidev workspace).
 */
export async function POST(req: NextRequest) {
  let body: {
    brief?: string;
    theme?: string;
    currentDeck?: unknown;
    target?: unknown;
    targets?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const brief = (body.brief ?? "").trim();
  if (!brief) {
    return NextResponse.json({ error: "A brief is required" }, { status: 400 });
  }
  if (brief.length > MAX_BRIEF_CHARS) {
    return NextResponse.json(
      { error: `Brief too long (max ${MAX_BRIEF_CHARS} characters)` },
      { status: 413 }
    );
  }

  // A revision turn carries the deck being edited; it must itself be valid.
  let currentDeck: DeckSpec | null = null;
  if (body.currentDeck !== undefined) {
    const parsed = deckSchema.safeParse(body.currentDeck);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "currentDeck is not a valid deck spec" },
        { status: 422 }
      );
    }
    currentDeck = parsed.data;
  }

  // An optional selection — one target ("slide 3, the headline") or several
  // ("slides 2, 4, 5") — scopes a revision to what the user clicked. Only
  // meaningful with a deck; out-of-range entries are silently dropped — the
  // instruction still applies, just (less) scoped.
  const targets: EditTarget[] = currentDeck
    ? sanitizeTargets(body.targets ?? body.target ?? [], currentDeck)
    : [];
  const target: EditTarget[] | null = targets.length > 0 ? targets : null;

  // On a fresh generation the theme pill wins; on a revision the deck's own
  // theme is the default and only the instruction may change it.
  const theme = currentDeck ? currentDeck.theme : pickTheme(body.theme);

  const provider = pickProvider();
  if (provider && typeof provider === "object") {
    return NextResponse.json({ error: provider.error }, { status: 500 });
  }

  let rawDeck: unknown;
  let source: "model" | "local";
  let model: string | null = null;

  if (provider === "anthropic") {
    try {
      rawDeck = await generateWithClaude(brief, theme, currentDeck, target);
      source = "model";
      model = ANTHROPIC_MODEL;
    } catch (e) {
      const { message, status } = await describeAnthropicError(e);
      return NextResponse.json({ error: message }, { status });
    }
  } else if (provider === "openrouter") {
    try {
      rawDeck = await generateWithOpenRouter(brief, theme, currentDeck, target);
      source = "model";
      model = openRouterModel();
    } catch (e) {
      if (e instanceof OpenRouterError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      return NextResponse.json(
        { error: `Generation failed: ${e instanceof Error ? e.message : String(e)}` },
        { status: 502 }
      );
    }
  } else {
    rawDeck = currentDeck ? reviseDeck(currentDeck, brief, target) : composeDeck(brief, theme);
    source = "local";
  }

  const result = validateDeck(rawDeck);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  // On fresh generations, force the requested theme even if the model picked
  // another. Revisions keep whatever the model returned (the instruction may
  // legitimately switch themes).
  const deck = currentDeck ? result.deck : { ...result.deck, theme };
  await setActiveDeck(deck);

  return NextResponse.json({ deck, source, model });
}

async function generateWithClaude(
  brief: string,
  theme: ThemeName,
  currentDeck: DeckSpec | null,
  target: EditTarget[] | null
): Promise<unknown> {
  // Imported lazily so the route still loads when the SDK isn't configured.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");

  const client = new Anthropic();
  const system = currentDeck ? `${SYSTEM_PROMPT}\n\n${REVISE_PROMPT}` : SYSTEM_PROMPT;
  const content = currentDeck
    ? revisionContent(currentDeck, brief, target)
    : `Brief: ${brief}\n\nPreferred theme: ${theme}. Design the deck.`;

  const message = await client.messages.parse({
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system,
    output_config: { format: zodOutputFormat(deckSchema) },
    messages: [{ role: "user", content }],
  });

  // `parse` validates against the schema and exposes the typed object; we
  // re-validate downstream with `validateDeck` regardless.
  return message.parsed_output ?? message;
}

/** Map SDK errors to a user-readable message + sensible proxy status. */
async function describeAnthropicError(e: unknown): Promise<{ message: string; status: number }> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  if (e instanceof Anthropic.AuthenticationError) {
    return { message: "Generation key rejected — check ANTHROPIC_API_KEY.", status: 502 };
  }
  if (e instanceof Anthropic.RateLimitError) {
    return { message: "Generation is rate-limited right now — try again shortly.", status: 429 };
  }
  if (e instanceof Anthropic.APIError) {
    return { message: `Generation failed (${e.status}): ${e.message}`, status: 502 };
  }
  return {
    message: `Generation failed: ${e instanceof Error ? e.message : String(e)}`,
    status: 502,
  };
}
