"use client";

import { Button } from "@mind-studio/ui";
import {
  Check,
  ExternalLink,
  FileDown,
  FolderOpen,
  Globe,
  Loader2,
  Lock,
  Save,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { siteBaseForId } from "@/lib/config";
import { buildSite, exportPdf } from "@/lib/publish/render-client";
import {
  type DeckMeta,
  listDecks,
  loadDeck,
  removeDeck,
  saveDeck,
  savePdf,
} from "@/lib/solid/deck-store";
import { publishSite, unpublishSite } from "@/lib/solid/site-store";
import type { DeckSpec } from "@/lib/spec/schema";
import { serializeDeck } from "@/lib/spec/serialize";

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
  // Publish-site state. `makePublic` is the per-publish public/private choice;
  // `progress` shows Building/Uploading; `published` holds the last result so we
  // can show the link + Unpublish.
  const [makePublic, setMakePublic] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const [pdfSaved, setPdfSaved] = useState(false);
  const [published, setPublished] = useState<{ indexUrl: string; isPublic: boolean } | null>(null);

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
        currentDeckId ?? undefined,
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

  // Publish/PDF need a pod id; a never-saved deck is saved first.
  async function ensureSaved(): Promise<string | null> {
    if (!currentDeck) return null;
    if (currentDeckId) return currentDeckId;
    const meta = await saveDeck(podRoot, currentDeck, new Date().toISOString());
    onSaved(meta.id);
    await refresh();
    return meta.id;
  }

  // Real Slidev PDF (Chromium) → stored at decks/<id>/deck.pdf.
  async function onSavePdf() {
    if (!currentDeck) return;
    setWorking("pdf");
    setError(null);
    setPdfSaved(false);
    try {
      const id = await ensureSaved();
      if (!id) return;
      const blob = await exportPdf(serializeDeck(currentDeck));
      await savePdf(podRoot, id, blob);
      setPdfSaved(true);
      setTimeout(() => setPdfSaved(false), 2500);
    } catch (e) {
      setError(`PDF failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setWorking(null);
    }
  }

  // slidev build → upload the static SPA to sites/<id>/ (+ public ACL if chosen).
  async function onPublish() {
    if (!currentDeck) return;
    setWorking("publish");
    setError(null);
    setPublished(null);
    try {
      const id = await ensureSaved();
      if (!id) return;
      setProgress("Building site…");
      const files = await buildSite(serializeDeck(currentDeck), siteBaseForId(podRoot, id));
      setProgress(`Uploading ${files.length} files…`);
      const res = await publishSite(podRoot, id, files, { public: makePublic });
      setPublished({ indexUrl: res.indexUrl, isPublic: res.isPublic });
    } catch (e) {
      setError(`Publish failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProgress(null);
      setWorking(null);
    }
  }

  async function onUnpublish() {
    if (!currentDeckId) return;
    setWorking("publish");
    setError(null);
    try {
      await unpublishSite(podRoot, currentDeckId);
      setPublished(null);
    } catch (e) {
      setError(`Unpublish failed: ${e instanceof Error ? e.message : String(e)}`);
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
      // Also tear down any published site — otherwise its (possibly public)
      // URL keeps serving the deck the user just deleted. Best-effort.
      await unpublishSite(podRoot, meta.id).catch(() => {});
      if (meta.id === currentDeckId) setPublished(null);
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

      {currentDeck && (
        <div className="mt-3 rounded-md border border-dashed p-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Export & publish
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={onSavePdf}
              disabled={!!working}
              data-testid="save-pdf-btn"
              title="Render a real Slidev PDF (Chromium) into your pod"
            >
              {working === "pdf" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : pdfSaved ? (
                <Check className="size-3.5 text-primary" />
              ) : (
                <FileDown className="size-3.5" />
              )}
              {pdfSaved ? "PDF saved" : "PDF to pod"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onPublish}
              disabled={!!working}
              data-testid="publish-site-btn"
              title="slidev build → publish a static site into your pod"
            >
              {working === "publish" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Globe className="size-3.5" />
              )}
              Publish site
            </Button>
            {/* Per-publish public/private choice. */}
            <button
              type="button"
              onClick={() => setMakePublic((v) => !v)}
              disabled={!!working}
              data-testid="publish-visibility-toggle"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-muted"
              title="Toggle who can view the published site"
            >
              {makePublic ? (
                <>
                  <Globe className="size-3" /> Public
                </>
              ) : (
                <>
                  <Lock className="size-3" /> Private
                </>
              )}
            </button>
          </div>

          {progress && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> {progress}
            </p>
          )}

          {published && (
            <div className="mt-2 rounded-md border border-primary/40 bg-primary/5 p-2 text-xs">
              <p className="flex items-center gap-1.5 text-foreground">
                {published.isPublic ? (
                  <Globe className="size-3 text-primary" />
                ) : (
                  <Lock className="size-3 text-primary" />
                )}
                Published {published.isPublic ? "publicly" : "privately"}
              </p>
              <a
                href={published.indexUrl}
                target="_blank"
                rel="noreferrer"
                data-testid="published-link"
                className="mt-1 flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline"
              >
                <ExternalLink className="size-3 shrink-0" />
                {published.indexUrl}
              </a>
              <button
                type="button"
                onClick={onUnpublish}
                disabled={!!working}
                className="mt-1.5 text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
              >
                Unpublish
              </button>
            </div>
          )}
        </div>
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
