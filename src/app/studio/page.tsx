"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ensureSession } from "@/lib/solid/auth";
import { currentIdentity, isBrokered, signalReady } from "@/lib/solid/broker";
import { deckSchema, type DeckSpec } from "@/lib/spec/schema";
import type { EditTarget } from "@/lib/spec/target";
import ChatPanel, { type DeckInfo } from "@/components/ChatPanel";
import DeckList from "@/components/DeckList";
import SlideInspector from "@/components/SlideInspector";
import DeckCanvas from "@/components/DeckCanvas";

/** localStorage key for the active deck — client-side only (pod invariant). */
const DECK_STORAGE_KEY = "mind-slides:active-deck";

export default function StudioPage() {
  const [deck, setDeck] = useState<DeckSpec | null>(null);
  // The pod id of the active deck, when it came from (or was saved to) the
  // pod. Re-saving overwrites that deck; a fresh generation clears it so the
  // next save creates a new one.
  const [deckPodId, setDeckPodId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [podRoot, setPodRoot] = useState<string | null>(null);
  // The active selection — one or MORE targets ("slide 3, the headline";
  // "slides 2, 4, 5"). Set from the inspector (plain click = single,
  // checkbox/meta-click = toggle), the preview (click an element), or the
  // chat's changed-slide chips; it scopes the next refine AND drives the
  // preview — the LAST target is the one the preview follows.
  const [targets, setTargets] = useState<EditTarget[]>([]);
  const active = targets.length > 0 ? targets[targets.length - 1] : null;
  const selectOne = (t: EditTarget) => setTargets([t]);
  // Toggle a slide in/out of the multi-selection (slide granularity — a
  // toggled-in slide replaces any field-scoped target on the same slide).
  const toggleTarget = (t: EditTarget) =>
    setTargets((prev) =>
      prev.some((x) => x.slide === t.slide)
        ? prev.filter((x) => x.slide !== t.slide)
        : [...prev, { slide: t.slide }]
    );
  // ⌘-click in the PREVIEW toggles by ELEMENT (slide + field), so several
  // elements — even on the same slide — accumulate one by one. A field pick
  // subsumes a bare whole-slide entry for that slide; a background ⌘-click
  // (no field) toggles the whole slide, clearing its field picks with it.
  const togglePreviewTarget = (t: EditTarget) =>
    setTargets((prev) => {
      if (t.field) {
        const exists = prev.some((x) => x.slide === t.slide && x.field === t.field);
        return exists
          ? prev.filter((x) => !(x.slide === t.slide && x.field === t.field))
          : [...prev.filter((x) => !(x.slide === t.slide && !x.field)), t];
      }
      return prev.some((x) => x.slide === t.slide)
        ? prev.filter((x) => x.slide !== t.slide)
        : [...prev, t];
    });
  // Bumped by the inspector's "Ask AI" buttons to focus the chat box.
  const [chatFocusKey, setChatFocusKey] = useState(0);
  // Which slide the preview is ACTUALLY showing (reported by the iframe on
  // every route change). Distinct from `selection`: the user can arrow through
  // the deck without touching the selection, and the inspector needs the real
  // position to decide whether a row re-click collapses or re-navigates.
  const [previewSlide, setPreviewSlide] = useState<number | null>(null);

  // Re-adopt the active deck after a reload. The deck spec only lives in
  // client state (the server keeps just the serialized markdown), so without
  // this a refresh orphans the studio: the preview still shows the deck, but
  // the outline/chips are gone and clicking slides looks dead. localStorage
  // mirrors whatever the preview is already showing — no server persistence.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DECK_STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as { deck?: unknown; podId?: unknown };
      const parsed = deckSchema.safeParse(stored.deck);
      if (parsed.success) {
        setDeck(parsed.data);
        setDeckPodId(typeof stored.podId === "string" ? stored.podId : null);
      }
    } catch {
      // Corrupt/legacy entry — ignore; the next generation rewrites it.
    }
  }, []);

  useEffect(() => {
    try {
      if (deck) {
        localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify({ deck, podId: deckPodId }));
      }
    } catch {
      // Quota/private-mode failures just lose reload-restore, nothing else.
    }
  }, [deck, deckPodId]);

  useEffect(() => {
    void ensureSession()
      .then(() => {
        // Brokered-first: inside the shell the pod root is the shell's workspace
        // pod (from the bridge welcome), NOT one derived from the webId — the two
        // can differ for a provisioned workspace. `currentIdentity()` returns the
        // brokered pod root when embedded, else the local session's.
        const id = currentIdentity();
        if (id) setPodRoot(id.podRoot);
        // Clear the shell's loading overlay once we've rendered (no-op standalone).
        if (isBrokered()) signalReady();
      })
      .catch(() => {});
  }, []);

  // Click-to-select from the in-app deck canvas: a plain DOM click reports
  // { slide, field, meta }. ⌘/Ctrl-click toggles that ELEMENT in the
  // multi-selection; a plain click replaces the selection.
  function onCanvasSelect(p: { slide: number; field: string | null; meta: boolean }) {
    if (typeof p.slide !== "number") return;
    if (p.meta) {
      togglePreviewTarget({ slide: p.slide, field: p.field ?? undefined });
    } else {
      setTargets([{ slide: p.slide, field: p.field ?? undefined }]);
    }
  }

  // Generation and "load example" hand back a fresh deck; the canvas re-renders
  // from this client state (no sidecar, no shared file).
  function onDeck(next: DeckSpec, info: DeckInfo) {
    setDeck(next);
    if (!info.refined) {
      setDeckPodId(null);
      setTargets([]);
    } else {
      setTargets((prev) => prev.filter((t) => t.slide <= next.slides.length));
    }
  }

  // A direct edit from the inspector — already schema-validated; make it the
  // active deck (the canvas re-renders from this state, no server round-trip).
  // Keeps the pod id: editing a saved deck means the next save overwrites it.
  // Async to match the inspector/deck-list prop signatures, though rendering is
  // now synchronous client state — no awaited server round-trip remains.
  async function applyEdit(next: DeckSpec) {
    setDeck(next);
    setTargets((prev) => prev.filter((t) => t.slide <= next.slides.length));
  }

  // A pod deck is only fetched, not yet active — make it the active deck.
  async function onPodLoad(next: DeckSpec, id: string) {
    setDeck(next);
    setDeckPodId(id);
    setTargets([]);
  }

  return (
    // Stacked (mobile): the preview comes FIRST and stays stuck to the top
    // while the chat/inspector scroll beneath it — authoring on a phone has to
    // show the deck reacting, not bury it below the fold. Side-by-side (lg+):
    // fixed height, sidebar left, panels scroll internally.
    <div className="flex min-h-[calc(100vh-65px)] flex-col lg:h-[calc(100vh-65px)] lg:flex-row">
      <aside className="order-2 flex w-full shrink-0 flex-col border-r lg:order-1 lg:w-[400px]">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {deck ? deck.title : "No deck yet"}
          </span>
          {deck && (
            <span className="ml-2 shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              {deck.slides.length} · {deck.theme}
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChatPanel
            currentDeck={deck}
            onDeck={onDeck}
            busy={busy}
            setBusy={setBusy}
            targets={targets}
            onRemoveTarget={(t) =>
              setTargets((prev) => prev.filter((x) => !(x.slide === t.slide && x.field === t.field)))
            }
            onSelectTarget={selectOne}
            focusKey={chatFocusKey}
          />

          {deck && (
            <SlideInspector
              deck={deck}
              targets={targets}
              active={active}
              previewSlide={previewSlide}
              onSelect={(t) => (t ? selectOne(t) : setTargets([]))}
              onToggle={toggleTarget}
              onField={(t) =>
                setTargets((prev) => [...prev.filter((x) => x.slide !== t.slide), t])
              }
              onApply={applyEdit}
              onAskAi={(t) => {
                selectOne(t);
                setChatFocusKey((k) => k + 1);
              }}
              busy={busy}
            />
          )}

          {podRoot ? (
            <DeckList
              podRoot={podRoot}
              currentDeck={deck}
              currentDeckId={deckPodId}
              onLoad={onPodLoad}
              onSaved={setDeckPodId}
              onDeleted={(id) => {
                if (id === deckPodId) setDeckPodId(null);
              }}
            />
          ) : (
            <div className="border-t p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Your pod · decks
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Generation works without signing in.{" "}
                <Link href="/connect" className="text-primary underline-offset-4 hover:underline">
                  Connect a pod
                </Link>{" "}
                to save decks.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Definite height when stacked — the preview's inner h-full/absolute
          chain needs a resolvable base, which min-height alone doesn't give. */}
      <section className="sticky top-0 z-20 order-1 h-[38vh] min-h-[240px] shrink-0 border-b lg:static lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1 lg:border-b-0">
        <DeckCanvas
          deck={deck}
          onSlideChange={setPreviewSlide}
          selection={active}
          targets={targets}
          onSelect={onCanvasSelect}
        />
      </section>
    </div>
  );
}
