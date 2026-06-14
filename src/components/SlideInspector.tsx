"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@mind-studio/ui";
import { Check, ListTree, Sparkles, Square, SquareCheck, Trash2, Undo2 } from "lucide-react";
import { deckSchema, type DeckSpec, type Slide } from "@/lib/spec/schema";
import { navTitleOf } from "@/lib/spec/serialize";
import { BLOCK_FIELDS, type EditTarget, type FieldDef } from "@/lib/spec/target";

interface Props {
  deck: DeckSpec;
  /** Every selected target; the AI refine applies to all of them. */
  targets: EditTarget[];
  /** The target the preview follows + whose editor is expanded (the last). */
  active: EditTarget | null;
  /** The slide the preview is actually showing (iframe-reported), if known. */
  previewSlide: number | null;
  /** Plain click: replace the selection (null clears it). */
  onSelect: (target: EditTarget | null) => void;
  /** Checkbox / meta-click: toggle a slide in or out of the multi-selection. */
  onToggle: (target: EditTarget) => void;
  /** Field click/focus in the editor: re-scope THIS slide's target to the
   *  field without dropping the other selected slides. */
  onField: (target: EditTarget) => void;
  /** Validate + render + adopt an edited deck. */
  onApply: (deck: DeckSpec) => Promise<void>;
  /** Arm the target AND focus the chat box — "describe the change up there". */
  onAskAi: (target: EditTarget) => void;
  busy: boolean;
}

/**
 * Direct manipulation for the active deck: an outline of slides, each
 * expandable into a form over its block's fields, edited in place — no prose
 * ("change slide 3...") needed. Selection is shared state with the preview
 * (click an element in the iframe → the same slide/field selects here) and
 * with the chat (a selection scopes the AI instruction).
 *
 * Edits stay inside the DeckSpec contract: the form writes block fields only,
 * the result is `deckSchema`-validated before rendering. There is no styling
 * or layout surface here, by design.
 */
export default function SlideInspector({
  deck,
  targets,
  active,
  previewSlide,
  onSelect,
  onToggle,
  onField,
  onApply,
  onAskAi,
  busy,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // A selection arriving from the preview iframe should reveal its editor.
  useEffect(() => {
    if (!active) return;
    listRef.current
      ?.querySelector(`[data-slide-item="${active.slide}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <div className="border-t p-4" ref={listRef}>
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <ListTree className="size-3.5" /> Slides — click to edit
      </p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
        tick boxes to refine several slides at once
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {deck.slides.map((slide, i) => {
          const n = i + 1;
          const inSet = targets.some((t) => t.slide === n);
          const isActive = active?.slide === n;
          return (
            <div
              key={`${n}-${slide.block}`}
              data-slide-item={n}
              className={`rounded-md border transition ${
                inSet ? "border-primary/60 bg-primary/5" : "hover:border-primary/40"
              }`}
            >
              <div className="flex w-full items-center gap-2 px-3 py-2 text-sm">
                {/* Multi-select checkbox: toggles this slide in/out of the
                    selection without collapsing the rest. */}
                <button
                  onClick={() => onToggle({ slide: n })}
                  title={inSet ? "Remove from selection" : "Add to selection"}
                  data-testid={`slide-check-${n}`}
                  className={`-m-1 rounded p-1 transition ${
                    inSet ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
                  }`}
                >
                  {inSet ? <SquareCheck className="size-3.5" /> : <Square className="size-3.5" />}
                </button>
                {/* A plain click replaces the selection. A click on the sole
                    selected row collapses it — but only when the preview is
                    already showing that slide; if the user navigated the deck
                    away (arrows, space), the re-click means "take me back
                    there". Meta/ctrl-click toggles, like the checkbox. */}
                <button
                  onClick={(e) =>
                    e.metaKey || e.ctrlKey
                      ? onToggle({ slide: n })
                      : onSelect(
                          isActive &&
                            targets.length === 1 &&
                            (previewSlide === null || previewSlide === n)
                            ? null
                            : { slide: n }
                        )
                  }
                  data-testid={`slide-item-${n}`}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {String(n).padStart(2, "0")}
                  </span>
                  <span className="truncate">{navTitleOf(slide)}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {slide.block}
                  </span>
                </button>
              </div>
              {isActive && (
                <SlideEditor
                  key={n}
                  deck={deck}
                  index={i}
                  slide={slide}
                  field={active?.field}
                  onField={(field) => onField({ slide: n, field })}
                  onApply={onApply}
                  onAskAi={onAskAi}
                  busy={busy}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- per-slide form ---------------------------------------------------------

/** Form value per field — strings for text, one-per-line text for the rest. */
type Draft = Record<string, string | { heading: string; points: string }>;

function toDraft(slide: Slide): Draft {
  const record = slide as unknown as Record<string, unknown>;
  const draft: Draft = {};
  for (const def of BLOCK_FIELDS[slide.block]) {
    const v = record[def.key];
    if (def.kind === "text") {
      draft[def.key] = typeof v === "string" ? v : "";
    } else if (def.kind === "lines") {
      draft[def.key] = Array.isArray(v) ? (v as string[]).join("\n") : "";
    } else if (def.kind === "column") {
      const col = (v ?? { heading: "", points: [] }) as { heading: string; points: string[] };
      draft[def.key] = { heading: col.heading, points: col.points.join("\n") };
    } else {
      const items = Array.isArray(v) ? (v as { date: string; label: string }[]) : [];
      draft[def.key] = items.map((it) => `${it.date} — ${it.label}`).join("\n");
    }
  }
  return draft;
}

function fromDraft(slide: Slide, draft: Draft): Slide {
  const next: Record<string, unknown> = { block: slide.block };
  for (const def of BLOCK_FIELDS[slide.block]) {
    const v = draft[def.key];
    if (def.kind === "text") {
      const s = (v as string).trim();
      if (s || !def.optional) next[def.key] = s;
    } else if (def.kind === "lines") {
      next[def.key] = (v as string)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    } else if (def.kind === "column") {
      const col = v as { heading: string; points: string };
      next[def.key] = {
        heading: col.heading.trim(),
        points: col.points.split("\n").map((l) => l.trim()).filter(Boolean),
      };
    } else {
      // timeline lines: "date — label" (also accepts : or |).
      next[def.key] = (v as string)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const m = l.match(/^(.+?)\s*[—–:|]\s*(.+)$/);
          return m ? { date: m[1].trim(), label: m[2].trim() } : { date: "", label: l };
        });
    }
  }
  return next as unknown as Slide;
}

function SlideEditor({
  deck,
  index,
  slide,
  field,
  onField,
  onApply,
  onAskAi,
  busy,
}: {
  deck: DeckSpec;
  index: number;
  slide: Slide;
  field?: string;
  onField: (field: string) => void;
  onApply: (deck: DeckSpec) => Promise<void>;
  onAskAi: (target: EditTarget) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(slide));
  const [error, setError] = useState<string | null>(null);
  // Re-sync when the deck changes under us (AI revision, pod load).
  useEffect(() => setDraft(toDraft(slide)), [slide]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(toDraft(slide)),
    [draft, slide]
  );

  async function apply(slides: Slide[]) {
    setError(null);
    const parsed = deckSchema.safeParse({ ...deck, slides });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(`${issue.path.join(".") || "deck"}: ${issue.message}`);
      return;
    }
    await onApply(parsed.data);
  }

  function applyEdit() {
    const slides = [...deck.slides];
    slides[index] = fromDraft(slide, draft);
    void apply(slides);
  }

  function removeSlide() {
    if (deck.slides.length <= 1) return;
    const slides = deck.slides.filter((_, i) => i !== index);
    void apply(slides);
  }

  const n = index + 1;
  const inputCls =
    "w-full rounded-md border bg-card px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const labelCls = (key: string) =>
    `block w-fit cursor-pointer font-mono text-[10px] uppercase tracking-wider ${
      field === key ? "text-primary" : "text-muted-foreground"
    }`;

  function renderField(def: FieldDef) {
    const v = draft[def.key];
    const label = (
      <span className="mb-1 flex items-center gap-1.5">
        <label
          className={labelCls(def.key)}
          onClick={() => onField(def.key)}
          data-testid={`field-label-${def.key}`}
        >
          {def.key}
          {def.optional ? " ·optional" : ""}
        </label>
        <button
          onClick={() => onAskAi({ slide: n, field: def.key })}
          disabled={busy}
          title={`Ask AI to change ${def.key} — type the instruction above`}
          data-testid={`ask-ai-${def.key}`}
          className="-m-1.5 rounded p-1.5 text-muted-foreground/60 transition hover:text-primary disabled:opacity-50"
        >
          <Sparkles className="size-3" />
        </button>
      </span>
    );
    if (def.kind === "text") {
      return (
        <div key={def.key}>
          {label}
          <input
            value={v as string}
            onChange={(e) => setDraft({ ...draft, [def.key]: e.target.value })}
            onFocus={() => onField(def.key)}
            data-testid={`field-${def.key}`}
            className={inputCls}
          />
        </div>
      );
    }
    if (def.kind === "column") {
      const col = v as { heading: string; points: string };
      return (
        <div key={def.key} className="rounded-md border border-dashed p-2">
          {label}
          <input
            value={col.heading}
            onChange={(e) => setDraft({ ...draft, [def.key]: { ...col, heading: e.target.value } })}
            onFocus={() => onField(def.key)}
            placeholder="heading"
            className={inputCls}
          />
          <textarea
            value={col.points}
            onChange={(e) => setDraft({ ...draft, [def.key]: { ...col, points: e.target.value } })}
            onFocus={() => onField(def.key)}
            rows={3}
            placeholder="one point per line"
            className={`${inputCls} mt-1.5 resize-none`}
          />
        </div>
      );
    }
    // lines / timeline — one entry per line.
    return (
      <div key={def.key}>
        {label}
        <textarea
          value={v as string}
          onChange={(e) => setDraft({ ...draft, [def.key]: e.target.value })}
          onFocus={() => onField(def.key)}
          rows={Math.min(6, Math.max(3, (v as string).split("\n").length))}
          placeholder={def.kind === "timeline" ? "date — label, one per line" : "one per line"}
          data-testid={`field-${def.key}`}
          className={`${inputCls} resize-none`}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 border-t px-3 py-3" data-testid="slide-editor">
      {BLOCK_FIELDS[slide.block].map(renderField)}
      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          onClick={applyEdit}
          disabled={busy || !dirty}
          data-testid="apply-slide-edit"
        >
          <Check className="size-3.5" /> Apply
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDraft(toDraft(slide))}
          disabled={busy || !dirty}
          title="Discard edits"
        >
          <Undo2 className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAskAi({ slide: n })}
          disabled={busy}
          title="Ask AI to change this slide — type the instruction above"
          data-testid="ask-ai-slide"
        >
          <Sparkles className="size-3.5" /> Ask AI
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={removeSlide}
          disabled={busy || deck.slides.length <= 1}
          title={deck.slides.length <= 1 ? "A deck needs at least one slide" : "Remove this slide"}
          data-testid="remove-slide"
          className="ml-auto text-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
