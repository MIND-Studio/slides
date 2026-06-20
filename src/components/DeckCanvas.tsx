"use client";

import { Button } from "@mind-studio/ui";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileCode2,
  FileDown,
  Loader2,
  MonitorPlay,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { exportPdf } from "@/lib/publish/render-client";
import type { DeckSpec } from "@/lib/spec/schema";
import { serializeDeck } from "@/lib/spec/serialize";
import type { EditTarget } from "@/lib/spec/target";

/**
 * The live deck — rendered IN-PROCESS, not via a Slidev sidecar. A tiny Vue
 * widget (built from the real slidev/layouts/*.vue by widget/vite.config.ts and
 * served from /public/deck-widget) mounts here and renders the active DeckSpec.
 *
 * Because each browser renders its own deck from client state, there is no
 * shared slides.md and no shared process — concurrent users no longer clobber
 * each other (the v0 sidecar's core limitation). Click-to-select is now a plain
 * DOM event, no cross-origin postMessage bridge.
 */

type SelectPayload = { slide: number; field: string | null; meta: boolean };

interface DeckController {
  update(props: {
    deck?: unknown;
    activeSlide?: number;
    embedded?: boolean;
    targets?: { slide: number; field?: string | null }[];
    onSelect?: (p: SelectPayload) => void;
  }): void;
  exportPdf(): void;
  destroy(): void;
}

declare global {
  interface Window {
    MindDeck?: {
      mount(
        el: HTMLElement,
        props: {
          deck: unknown;
          activeSlide?: number;
          embedded?: boolean;
          targets?: { slide: number; field?: string | null }[];
          onSelect?: (p: SelectPayload) => void;
        },
      ): DeckController;
    };
  }
}

// Export PDF prints from the active deck — the live widget already renders the
// same `.vue` layouts, so the PDF is byte-identical to the on-screen preview.

const WIDGET_JS = "/deck-widget/deck-widget.js";
const WIDGET_CSS = "/deck-widget/deck-widget.css";

let widgetPromise: Promise<void> | null = null;
/** Load the widget bundle once per page (idempotent across canvas instances). */
function loadWidget(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MindDeck) return Promise.resolve();
  if (widgetPromise) return widgetPromise;
  widgetPromise = new Promise<void>((resolve, reject) => {
    if (!document.querySelector(`link[data-deck-widget]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = WIDGET_CSS;
      link.dataset.deckWidget = "1";
      document.head.appendChild(link);
    }
    const s = document.createElement("script");
    s.src = WIDGET_JS;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load deck widget"));
    document.head.appendChild(s);
  });
  return widgetPromise;
}

interface Props {
  deck: DeckSpec | null;
  /** Reported up whenever the visible slide changes (drives previewSlide). */
  onSlideChange?: (slide: number) => void;
  /** The preview follows this — navigating to its slide. */
  selection?: EditTarget | null;
  /** Every selected element on the visible slide gets the persistent outline. */
  targets?: EditTarget[];
  /** Click-to-select from the slide surface. */
  onSelect?: (p: SelectPayload) => void;
}

export default function DeckCanvas({
  deck,
  onSlideChange,
  selection = null,
  targets = [],
  onSelect,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<DeckController | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [slide, setSlide] = useState(1); // 1-based visible slide
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Latest onSelect without re-mounting the widget on every render.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const slideCount = deck?.slides.length ?? 0;

  useEffect(() => {
    let alive = true;
    loadWidget()
      .then(() => alive && setReady(true))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  // Mount the widget once it's loaded and a deck first becomes available.
  // We depend on the PRESENCE of a deck, not the deck object itself: a new deck
  // object on every edit would otherwise tear down and recreate the whole Vue
  // app each revision (flicker, lost focus). Subsequent deck changes flow
  // through the update() effect below.
  const deckPresent = deck !== null;
  useEffect(() => {
    if (!ready || !hostRef.current || !deck || ctrlRef.current) return;
    ctrlRef.current = window.MindDeck!.mount(hostRef.current, {
      deck,
      activeSlide: slide,
      embedded: true,
      targets,
      onSelect: (p) => onSelectRef.current?.(p),
    });
    return () => {
      ctrlRef.current?.destroy();
      ctrlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, deckPresent]);

  // Clamp the visible slide to the deck and report it up.
  useEffect(() => {
    if (slideCount === 0) return;
    const clamped = Math.min(Math.max(1, slide), slideCount);
    if (clamped !== slide) setSlide(clamped);
    else onSlideChange?.(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, slideCount]);

  // Follow the shared selection — navigate to its slide.
  useEffect(() => {
    if (selection && selection.slide >= 1) setSlide(selection.slide);
  }, [selection]);

  // Push prop changes into the widget.
  useEffect(() => {
    ctrlRef.current?.update({
      deck: deck ?? undefined,
      activeSlide: slide,
      targets,
    });
  }, [deck, slide, targets]);

  // Arrow-key navigation when the canvas has focus.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      setSlide((s) => Math.min(s + 1, slideCount || 1));
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      setSlide((s) => Math.max(s - 1, 1));
      e.preventDefault();
    }
  }

  function slugify() {
    return (
      deck?.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "deck"
    );
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadMarkdown() {
    if (!deck) return;
    downloadBlob(new Blob([serializeDeck(deck)], { type: "text/markdown" }), `${slugify()}.md`);
  }

  // Real Slidev PDF (Chromium, via the worker) — not browser print.
  async function onExportPdf() {
    if (!deck || exporting) return;
    setExporting(true);
    try {
      const blob = await exportPdf(serializeDeck(deck));
      downloadBlob(blob, `${slugify()}.pdf`);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b bg-card px-4 py-2">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {showMarkdown ? (
            <>
              <FileCode2 className="size-3.5 text-primary" /> Markdown · slides.md
            </>
          ) : (
            <>
              <MonitorPlay className="size-3.5 text-primary" /> Live preview
            </>
          )}
        </span>
        <div className="flex items-center gap-1">
          {deck && slideCount > 0 && !showMarkdown && (
            <span className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSlide((s) => Math.max(s - 1, 1))}
                disabled={slide <= 1}
                title="Previous slide"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[3.5ch] text-center font-mono text-[11px] text-muted-foreground">
                {slide}/{slideCount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSlide((s) => Math.min(s + 1, slideCount))}
                disabled={slide >= slideCount}
                title="Next slide"
              >
                <ChevronRight className="size-4" />
              </Button>
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowMarkdown((v) => !v)}
            title={showMarkdown ? "Back to live preview" : "View Markdown source"}
            data-testid="markdown-toggle"
            className={showMarkdown ? "text-primary" : undefined}
          >
            <FileCode2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={downloadMarkdown}
            title="Download Slidev Markdown"
            data-testid="download-md-btn"
            disabled={!deck}
          >
            <Download className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onExportPdf}
            title="Export PDF (real Slidev render)"
            data-testid="export-pdf-btn"
            disabled={!deck || exporting}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="relative flex-1 bg-black">
        {showMarkdown && (
          <pre
            data-testid="markdown-view"
            className="absolute inset-0 z-10 overflow-auto whitespace-pre-wrap break-words bg-card p-4 font-mono text-xs leading-relaxed text-foreground"
          >
            {deck ? serializeDeck(deck) : "No active deck yet — generate one or load an example."}
          </pre>
        )}
        {failed ? (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load the deck renderer. Run{" "}
              <code className="font-mono">npm run build:widget</code> and reload.
            </p>
          </div>
        ) : !deck ? (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              No deck yet — generate one or load an example
            </p>
          </div>
        ) : (
          <div
            ref={hostRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            data-testid="deck-canvas"
            className="absolute inset-0 outline-none"
          />
        )}
      </div>
    </div>
  );
}
