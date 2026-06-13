"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@mind-studio/ui";
import {
  Sparkles,
  Loader2,
  LayoutTemplate,
  PenLine,
  Crosshair,
  X,
  ChevronRight,
} from "lucide-react";
import { THEMES, type ThemeName, type DeckSpec } from "@/lib/spec/schema";
import { exampleDecks } from "@/lib/spec/examples";
import type { EditTarget } from "@/lib/spec/target";

export interface DeckInfo {
  source: "model" | "local" | "example";
  refined: boolean;
}

interface Props {
  currentDeck: DeckSpec | null;
  onDeck: (deck: DeckSpec, info: DeckInfo) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  /** Active selection (one or more targets) — scopes a refine to all of them. */
  targets?: EditTarget[];
  /** Remove one target chip (removing the last clears the selection). */
  onRemoveTarget?: (target: EditTarget) => void;
  /** Select a slide elsewhere (inspector expands, preview navigates). */
  onSelectTarget?: (target: EditTarget) => void;
  /** Bump to focus the instruction box (the inspector's "Ask AI" buttons). */
  focusKey?: number;
}

/**
 * The authoring loop. One text box, two modes: with no active deck the text is
 * a brief (new deck); with an active deck it defaults to a revision
 * instruction sent alongside the current spec, so "make slide 3 punchier"
 * edits in place instead of regenerating. The mode pills make the choice
 * explicit and reversible.
 */
export default function ChatPanel({
  currentDeck,
  onDeck,
  busy,
  setBusy,
  targets = [],
  onRemoveTarget,
  onSelectTarget,
  focusKey = 0,
}: Props) {
  const [brief, setBrief] = useState("");
  const [theme, setTheme] = useState<ThemeName>("mind");
  const [refine, setRefine] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Which slides the last refine actually touched — rendered as clickable
  // chips so the answer connects back to the deck.
  const [changedSlides, setChangedSlides] = useState<number[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const refining = Boolean(currentDeck) && refine;
  const activeTheme = currentDeck ? currentDeck.theme : theme;

  // The inspector's "Ask AI" hands off here: selection is already armed,
  // put the cursor where the instruction goes.
  useEffect(() => {
    if (!focusKey) return;
    // preventScroll: the browser's own focus-scroll races (and cancels) the
    // smooth scroll below. Scroll the whole composer (chip + box) to its
    // scroll-margin — on mobile that margin clears the sticky preview, which
    // a centered scroll would put the chip behind.
    inputRef.current?.focus({ preventScroll: true });
    composerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focusKey]);

  /** 1-based numbers of slides that differ between two specs. */
  function diffSlides(prev: DeckSpec, next: DeckSpec): number[] {
    const out: number[] = [];
    for (let i = 0; i < next.slides.length; i++) {
      if (JSON.stringify(prev.slides[i] ?? null) !== JSON.stringify(next.slides[i])) {
        out.push(i + 1);
      }
    }
    return out;
  }

  async function generate() {
    const trimmed = brief.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    setChangedSlides([]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          refining
            ? { brief: trimmed, currentDeck, ...(targets.length > 0 ? { targets } : {}) }
            : { brief: trimmed, theme }
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Generation failed (${res.status})`);
        return;
      }
      const next = json.deck as DeckSpec;
      const changed = refining && currentDeck ? diffSlides(currentDeck, next) : [];
      const removed =
        refining && currentDeck ? currentDeck.slides.length - next.slides.length : 0;
      onDeck(next, { source: json.source, refined: refining });
      setBrief("");
      // Chips only when the change is scoped — "everything changed" needs no map.
      setChangedSlides(changed.length < next.slides.length ? changed : []);
      const what = refining
        ? changed.length === next.slides.length
          ? "Revised the whole deck"
          : changed.length > 0
            ? `Revised slide${changed.length === 1 ? "" : "s"} ${changed.join(", ")}`
            : removed > 0
              ? `Removed ${removed} slide${removed === 1 ? "" : "s"}`
              : "Revised — no slide content changed"
        : "Generated";
      setNote(
        json.source === "local"
          ? `${what} offline (no generation key set) — composed deterministically.`
          : `${what} with ${json.model ?? "the model"}.`
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Make a deck active (theme switch, examples). The canvas renders it from
   *  client state — no server round-trip. */
  function render(deck: DeckSpec, info: DeckInfo) {
    if (busy) return;
    setError(null);
    setNote(null);
    setChangedSlides([]);
    onDeck(deck, info);
  }

  function pickTheme(t: ThemeName) {
    setTheme(t);
    // With an active deck the pill reskins it immediately — same spec, new
    // palette — instead of waiting for the next generation.
    if (currentDeck && currentDeck.theme !== t) {
      void render({ ...currentDeck, theme: t }, { source: "example", refined: true });
    }
  }

  return (
    // Pre-deck the panel fills the sidebar (examples pinned to the bottom);
    // with an active deck it sizes naturally so the slide inspector below
    // stays above the fold instead of behind a stretch gap.
    <div className={`flex flex-col gap-4 p-4 ${currentDeck ? "" : "h-full"}`}>
      {/* scroll-mt: where the "Ask AI" handoff scrolls this to — below the
          sticky mobile preview (38vh + chrome); a small offset on lg. */}
      <div ref={composerRef} className="scroll-mt-[42vh] lg:scroll-mt-4">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {refining ? "Refine this deck" : "Describe your deck"}
          </label>
          {currentDeck && (
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Mode">
              <button
                role="radio"
                aria-checked={refine}
                onClick={() => setRefine(true)}
                data-testid="mode-refine"
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition ${
                  refine
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <PenLine className="size-3" /> Refine
              </button>
              <button
                role="radio"
                aria-checked={!refine}
                onClick={() => setRefine(false)}
                data-testid="mode-new"
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition ${
                  !refine
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                New deck
              </button>
            </div>
          )}
        </div>
        {refining && targets.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {targets.map((t) => (
              <button
                key={`${t.slide}-${t.field ?? ""}`}
                onClick={() => onRemoveTarget?.(t)}
                data-testid="target-chip"
                title="Remove from selection"
                className="flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary transition hover:border-primary"
              >
                <Crosshair className="size-3" />
                Slide {t.slide}
                {t.field ? ` · ${t.field}` : ""}
                <X className="size-3 opacity-70" />
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate();
          }}
          placeholder={
            refining
              ? targets.length === 1
                ? `e.g. Make it punchier. Rewrite it for a CFO audience. — applies to slide ${targets[0].slide}${targets[0].field ? `'s ${targets[0].field}` : ""}`
                : targets.length > 1
                  ? `e.g. Make them punchier. Unify the tone. — applies to slides ${targets.map((t) => t.slide).join(", ")}`
                  : "e.g. Make slide 3 punchier. Add a quote from our first customer. Switch to arctic. Or select a slide below / click an element in the preview."
              : "e.g. A 6-slide pitch for Aurora, a privacy-first notes app. Open with a bold hero, show a big number for adoption, compare us to the cloud incumbents, end on a section break."
          }
          rows={6}
          data-testid="brief-input"
          className="mt-2 w-full resize-none rounded-lg border bg-card px-3 py-2.5 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="mt-1 hidden text-right font-mono text-[10px] text-muted-foreground/70 sm:block">
          ⌘⏎ to {refining ? "refine" : "generate"}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={activeTheme === t}
              onClick={() => pickTheme(t)}
              disabled={busy}
              data-testid={`theme-${t}`}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition disabled:opacity-50 ${
                activeTheme === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <Button onClick={generate} disabled={busy || !brief.trim()} data-testid="generate-btn">
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {refining ? "Refine" : "Generate"}
        </Button>
      </div>

      {busy && (
        // Generation takes seconds — say so, beyond the button spinner.
        <p
          aria-live="polite"
          data-testid="chat-busy"
          className="flex animate-pulse items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
          {refining ? "Revising the deck — usually a few seconds…" : "Composing your deck — usually a few seconds…"}
        </p>
      )}
      {error && (
        <p
          data-testid="chat-error"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {note && (
        <div
          data-testid="chat-note"
          className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          {note}
          {changedSlides.length > 0 && (
            <span className="mt-1.5 flex flex-wrap items-center gap-1">
              {changedSlides.map((n) => (
                <button
                  key={n}
                  onClick={() => onSelectTarget?.({ slide: n })}
                  data-testid={`changed-slide-${n}`}
                  title={`Jump to slide ${n}`}
                  className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary transition hover:border-primary"
                >
                  Slide {n}
                </button>
              ))}
            </span>
          )}
        </div>
      )}

      {/* Pre-deck the examples ARE the call to action — open list, pinned to
          the bottom. With a deck active they're secondary: collapsed behind a
          disclosure so chat and the slide outline sit next to each other. */}
      {currentDeck ? (
        <details className="group" data-testid="examples-details">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
            <LayoutTemplate className="size-3.5" /> Or load an example
          </summary>
          <ExampleList busy={busy} onPick={(d) => render(d, { source: "example", refined: false })} />
        </details>
      ) : (
        <div className="mt-auto">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <LayoutTemplate className="size-3.5" /> Or load an example
          </p>
          <ExampleList busy={busy} onPick={(d) => render(d, { source: "example", refined: false })} />
        </div>
      )}
    </div>
  );
}

function ExampleList({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (deck: DeckSpec) => void;
}) {
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {exampleDecks.map((deck, i) => (
        <button
          key={deck.title}
          onClick={() => onPick(deck)}
          disabled={busy}
          data-testid={`example-${i}`}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary/50 hover:bg-accent disabled:opacity-50"
        >
          <span className="truncate">{deck.title}</span>
          <span className="ml-3 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {deck.slides.length} · {deck.theme}
          </span>
        </button>
      ))}
    </div>
  );
}
