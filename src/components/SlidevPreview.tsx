"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@mind-studio/ui";
import { RefreshCw, ExternalLink, MonitorPlay, Download, FileCode2 } from "lucide-react";
import type { EditTarget } from "@/lib/spec/target";

export const SLIDEV_URL =
  process.env.NEXT_PUBLIC_SLIDEV_URL ?? "http://localhost:3101";

interface Props {
  reloadKey?: number;
  /** Active deck title — used for the exported Markdown filename. */
  deckTitle?: string | null;
  /** Shared selection — the preview follows it (navigates + outlines). */
  selection?: EditTarget | null;
  /** Full multi-selection — every targeted element on the visible slide gets
   *  the persistent outline, not just the last-touched one. */
  targets?: EditTarget[];
}

/**
 * The live deck. Slidev runs as a sidecar on :3101; when the active deck's
 * Markdown is rewritten server-side, Slidev's Vite HMR repaints THIS iframe
 * automatically (the iframe runs Slidev's own app, with its own HMR socket).
 *
 * `reloadKey` lets callers force a hard reload after a generation, in case HMR
 * didn't catch a brand-new file. We probe the sidecar on mount — and keep
 * re-probing every few seconds while it's down, so starting `npm run slidev`
 * brings the preview up without a manual refresh.
 */
export default function SlidevPreview({
  reloadKey = 0,
  deckTitle = null,
  selection = null,
  targets = [],
}: Props) {
  const [up, setUp] = useState<boolean | null>(null);
  // The key actually applied to the iframe. Remounting the instant the deck is
  // written races the sidecar's file watcher (a fresh boot can still compile
  // the OLD markdown, and Slidev HMR never hot-applies frontmatter — where all
  // our content lives). Waiting ~1s lets Vite invalidate first, so the reload
  // is guaranteed to compile the new deck.
  const [appliedKey, setAppliedKey] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Markdown view — a read-only look at the serialized slides.md the deck
  // renders from. An overlay, not a swap: the iframe stays mounted so the
  // live deck keeps its position when toggling back.
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [markdown, setMarkdown] = useState("");

  useEffect(() => {
    if (!showMarkdown) return;
    let alive = true;
    fetch("/api/render")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { markdown?: string } | null) => {
        if (alive && j) setMarkdown(j.markdown ?? "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [showMarkdown, reloadKey]);

  useEffect(() => {
    if (reloadKey === appliedKey) return;
    const t = setTimeout(() => setAppliedKey(reloadKey), 1000);
    return () => clearTimeout(t);
  }, [reloadKey, appliedKey]);

  // Push the shared selection into the iframe: the sidecar's setup hook
  // navigates to the slide and outlines the field. Posts are gated on the
  // app's `mind-slides:ready` handshake — posting during load would target a
  // window that is still same-origin about:blank (a console warning per post)
  // — and re-sent on every (re)boot, so a remount after a generation lands
  // back on the selected slide instead of slide 1.
  const slidevOrigin = new URL(SLIDEV_URL).origin;
  const frameReady = useRef(false);
  function postSelection() {
    if (!frameReady.current) return;
    frameRef.current?.contentWindow?.postMessage(
      {
        type: "mind-slides:focus",
        slide: selection?.slide ?? null,
        field: selection?.field ?? null,
        targets: targets.map((t) => ({ slide: t.slide, field: t.field ?? null })),
      },
      slidevOrigin
    );
  }
  useEffect(() => {
    frameReady.current = false;
  }, [appliedKey]);
  useEffect(() => {
    postSelection();
    function onMessage(e: MessageEvent) {
      if (e.origin !== slidevOrigin) return;
      if ((e.data as { type?: string })?.type === "mind-slides:ready") {
        frameReady.current = true;
        postSelection();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, targets, appliedKey, up]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const probe = () => {
      // no-cors: we can't read the response, but a resolved fetch means it's up.
      fetch(SLIDEV_URL, { mode: "no-cors" })
        .then(() => alive && setUp(true))
        .catch(() => {
          if (!alive) return;
          setUp(false);
          timer = setTimeout(probe, 3000);
        });
    };
    probe();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [reloadKey]);

  function hardReload() {
    if (frameRef.current) frameRef.current.src = SLIDEV_URL + `?t=${Date.now()}`;
  }

  async function downloadMarkdown() {
    const res = await fetch("/api/render");
    if (!res.ok) return;
    const { markdown } = (await res.json()) as { markdown: string };
    if (!markdown) return;
    const slug =
      (deckTitle ?? "deck")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "deck";
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
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
              <MonitorPlay className="size-3.5 text-primary" /> Live preview · :3101
            </>
          )}
        </span>
        <div className="flex items-center gap-1">
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
          >
            <Download className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={hardReload} title="Reload preview">
            <RefreshCw className="size-4" />
          </Button>
          <Button asChild variant="ghost" size="icon-sm" title="Open in new tab">
            <a href={SLIDEV_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </div>

      <div className="relative flex-1 bg-black">
        {showMarkdown && (
          <pre
            data-testid="markdown-view"
            className="absolute inset-0 z-10 overflow-auto bg-card p-4 font-mono text-xs leading-relaxed text-foreground"
          >
            {markdown || "No active deck yet — generate one or load an example."}
          </pre>
        )}
        {up === false ? (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Slidev sidecar not reachable
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Start it in a second terminal — the preview connects automatically:
              </p>
              <pre className="mt-3 inline-block rounded-md border bg-card px-4 py-2 text-left font-mono text-xs">
                npm run slidev
              </pre>
            </div>
          </div>
        ) : (
          <iframe
            ref={frameRef}
            key={appliedKey}
            // Unique URL per activation — the same cache-busting mechanism as
            // the manual reload button, made automatic.
            src={appliedKey ? `${SLIDEV_URL}/?r=${appliedKey}` : SLIDEV_URL}
            title="Slidev deck preview"
            // Slidev uses the Screen Wake Lock + clipboard APIs during
            // presentation; delegate them so the iframe doesn't log denials.
            allow="screen-wake-lock; clipboard-write; fullscreen"
            className="absolute inset-0 h-full w-full border-0"
            data-testid="slidev-frame"
          />
        )}
      </div>
    </div>
  );
}
