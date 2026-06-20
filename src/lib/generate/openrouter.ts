import { z } from "zod";
import { deckSchema, type DeckSpec, type ThemeName } from "@/lib/spec/schema";
import { SYSTEM_PROMPT, REVISE_PROMPT, revisionContent } from "@/lib/spec/prompt";
import type { EditTarget } from "@/lib/spec/target";

/**
 * OpenRouter generation backend. OpenRouter speaks the OpenAI-compatible
 * chat/completions API, so this is a plain fetch — no extra SDK. The DeckSpec
 * schema is enforced twice: via `response_format: json_schema` (zod v4 emits
 * the JSON Schema directly), and — as with every backend — by `validateDeck`
 * downstream. A model that ignores the response_format still can't smuggle
 * anything past validation.
 */

// Overridable for self-hosted gateways/proxies (and for testing).
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const OPENROUTER_URL = `${OPENROUTER_BASE_URL.replace(/\/$/, "")}/chat/completions`;

/** Override with OPENROUTER_MODEL — any OpenRouter slug works. */
export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    /** Status to proxy back to the studio. */
    readonly status: number
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export function openRouterModel(): string {
  return process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
}

export async function generateWithOpenRouter(
  brief: string,
  theme: ThemeName,
  currentDeck: DeckSpec | null,
  target: EditTarget | EditTarget[] | null = null,
  /** BYOK override; falls back to the company OPENROUTER_API_KEY when absent. */
  apiKey?: string
): Promise<unknown> {
  const system = currentDeck ? `${SYSTEM_PROMPT}\n\n${REVISE_PROMPT}` : SYSTEM_PROMPT;
  const content = currentDeck
    ? revisionContent(currentDeck, brief, target)
    : `Brief: ${brief}\n\nPreferred theme: ${theme}. Design the deck.`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey ?? process.env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      // Optional attribution headers OpenRouter recommends.
      "HTTP-Referer": "https://mindpods.org",
      "X-Title": "Mind Slides",
    },
    body: JSON.stringify({
      model: openRouterModel(),
      max_tokens: 8000,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "deck_spec",
          strict: true,
          schema: z.toJSONSchema(deckSchema),
        },
      },
    }),
  });

  if (!res.ok) {
    throw new OpenRouterError(await describeFailure(res), proxyStatus(res.status));
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    throw new OpenRouterError("OpenRouter returned an empty completion.", 502);
  }

  try {
    return JSON.parse(stripFences(text));
  } catch {
    throw new OpenRouterError(
      "OpenRouter returned non-JSON output — the selected model may not support structured outputs (set OPENROUTER_MODEL to one that does).",
      502
    );
  }
}

/** Some models wrap JSON in a markdown fence despite response_format. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

function proxyStatus(status: number): number {
  if (status === 429) return 429;
  return 502;
}

async function describeFailure(res: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? "";
  } catch {}
  if (res.status === 401) return "OpenRouter key rejected — check OPENROUTER_API_KEY.";
  if (res.status === 402) return "OpenRouter account has insufficient credits.";
  if (res.status === 429) return "OpenRouter is rate-limiting — try again shortly.";
  return `OpenRouter generation failed (${res.status})${detail ? `: ${detail}` : ""}`;
}
