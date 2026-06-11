import { NextRequest, NextResponse } from "next/server";
import { validateDeck } from "@/lib/spec/validate";
import { setActiveDeck, readActiveMarkdown } from "@/lib/slidev/workspace";

export const runtime = "nodejs";

/** Set the active deck (e.g. when a saved deck is selected) → Slidev repaints. */
export async function POST(req: NextRequest) {
  let body: { deck?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const result = validateDeck(body.deck);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  const markdown = await setActiveDeck(result.deck);
  return NextResponse.json({ ok: true, markdown });
}

/** Inspect the currently active Slidev Markdown (debug aid). */
export async function GET() {
  return NextResponse.json({ markdown: await readActiveMarkdown() });
}
