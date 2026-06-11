"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@mind-studio/ui";
import { Save, Trash2, FolderOpen, Loader2, Check } from "lucide-react";
import type { DeckSpec } from "@/lib/spec/schema";
import {
  listDecks,
  saveDeck,
  loadDeck,
  removeDeck,
  type DeckMeta,
} from "@/lib/solid/deck-store";

interface Props {
  podRoot: string;
  currentDeck: DeckSpec | null;
  /** Pod id of the active deck, when it was loaded from / saved to the pod. */
  currentDeckId: string | null;
  onLoad: (deck: DeckSpec, id: string) => void;
  onSaved: (id: string) => void;
  onDeleted: (id: string) => void;
}

/** Pod-backed deck library — visible only when signed in. */
export default function DeckList({
  podRoot,
  currentDeck,
  currentDeckId,
  onLoad,
  onSaved,
  onDeleted,
}: Props) {
  const [metas, setMetas] = useState<DeckMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMetas(await listDecks(podRoot));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [podRoot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSave() {
    if (!currentDeck) return;
    setWorking("save");
    setError(null);
    try {
      // Re-saving a deck that came from the pod updates it in place; a fresh
      // deck gets a new id.
      const meta = await saveDeck(
        podRoot,
        currentDeck,
        new Date().toISOString(),
        currentDeckId ?? undefined
      );
      onSaved(meta.id);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      await refresh();
    } catch (e) {
      setError(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setWorking(null);
    }
  }

  async function onOpen(id: string) {
    setWorking(id);
    setError(null);
    try {
      const deck = await loadDeck(podRoot, id);
      if (deck) onLoad(deck, id);
      else setError("Could not load that deck.");
    } finally {
      setWorking(null);
    }
  }

  async function onDelete(meta: DeckMeta) {
    if (!window.confirm(`Delete “${meta.title}” from your pod? This cannot be undone.`)) {
      return;
    }
    setWorking(meta.id);
    setError(null);
    try {
      await removeDeck(podRoot, meta.id);
      onDeleted(meta.id);
      await refresh();
    } catch (e) {
      setError(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="border-t p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Your pod · decks
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={!currentDeck || working === "save"}
          data-testid="save-deck-btn"
        >
          {working === "save" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : justSaved ? (
            <Check className="size-3.5 text-primary" />
          ) : (
            <Save className="size-3.5" />
          )}
          {justSaved ? "Saved" : currentDeckId ? "Update saved" : "Save current"}
        </Button>
      </div>

      {error && (
        <p className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-1.5" data-testid="deck-list">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : metas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No saved decks yet. Generate one and hit “Save current”.
          </p>
        ) : (
          metas.map((m) => (
            <div
              key={m.id}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm ${
                m.id === currentDeckId ? "border-primary/50 bg-primary/5" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate">{m.title}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.slideCount} slides · {m.theme}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => onOpen(m.id)}
                disabled={working === m.id}
                title="Open"
              >
                <FolderOpen className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => onDelete(m)}
                disabled={working === m.id}
                title="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
