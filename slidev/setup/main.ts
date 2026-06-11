/**
 * Slidev app setup — the studio's two-way bridge.
 *
 * When the deck runs EMBEDDED in the studio iframe, this hook connects the
 * preview to the studio's shared selection:
 *
 *   iframe → studio  `mind-slides:select`  clicking a slide element posts
 *                    which slide (1-based, from the route path) and which
 *                    field (from the `data-s-field` markers the layouts carry),
 *                    plus `meta` (⌘/Ctrl held) — the studio treats a meta-click
 *                    as "toggle this slide in the multi-selection" instead of
 *                    "replace the selection".
 *   iframe → studio  `mind-slides:ready`   posted once the listener below is
 *                    registered, so the studio can (re-)send its selection
 *                    after a reload without racing the app boot.
 *   iframe → studio  `mind-slides:slide`   where the deck actually is — posted
 *                    on boot and on every route change (arrow keys, space, the
 *                    slidev nav). Without it the studio can't tell "collapse
 *                    the editor" apart from "take me back to that slide" when
 *                    a selected outline row is clicked again.
 *   studio → iframe  `mind-slides:focus`   navigate to the active slide and
 *                    paint a persistent outline on EVERY selected field
 *                    (`targets` carries the full multi-selection) — the
 *                    preview follows the inspector/chat, not just vice versa.
 *
 * Standalone (full-tab) presentations are untouched: no listeners, no hover
 * affordance — the `s-embedded` root class gates both. Plain DOM only; this
 * file is typechecked by the app's tsc, which has no Slidev types (the ctx
 * param is what `defineAppSetup` would receive, typed minimally).
 */
export default function setup(ctx?: {
  router?: {
    replace?: (to: string) => unknown;
    afterEach?: (cb: (to: { path: string }) => void) => unknown;
  };
}) {
  if (typeof window === "undefined" || window.self === window.top) return;

  document.documentElement.classList.add("s-embedded");

  function currentSlide(): number {
    return Number(location.pathname.match(/\/(\d+)/)?.[1]);
  }

  document.addEventListener(
    "click",
    (e) => {
      // Only clicks on the slide CONTENT are a selection. Slidev's own chrome
      // (the nav toolbar, overview, …) lives outside #slide-content — treating
      // those as "select the current slide" made the studio's focus round-trip
      // yank the deck right back after every nav-arrow click.
      if (!(e.target as HTMLElement).closest?.("#slide-content")) return;
      const slide = currentSlide();
      if (!Number.isInteger(slide) || slide < 1) return;
      const el = (e.target as HTMLElement).closest?.("[data-s-field]");
      window.parent.postMessage(
        {
          type: "mind-slides:select",
          slide,
          field: el instanceof HTMLElement ? el.dataset.sField ?? null : null,
          meta: e.metaKey || e.ctrlKey,
        },
        // The payload is just a slide number + field name — nothing sensitive
        // — and the studio validates the *source* origin on receipt.
        "*"
      );
    },
    { capture: true }
  );

  // ---- studio → iframe: follow the shared selection -------------------------

  let highlightTimers: number[] = [];
  // The full multi-selection, kept so highlights survive route changes: every
  // selected field on whatever slide is visible gets the outline.
  let selectedTargets: { slide: number; field: string | null }[] = [];

  function clearHighlight() {
    highlightTimers.forEach((t) => window.clearTimeout(t));
    highlightTimers = [];
    document
      .querySelectorAll(".s-field-selected")
      .forEach((el) => el.classList.remove("s-field-selected"));
  }

  /** Outline one selected field on the visible slide, retrying briefly while
   *  the route transition mounts it. */
  function highlight(field: string, tries = 12) {
    const els = Array.from(document.querySelectorAll(`[data-s-field="${field}"]`));
    const target =
      els.find((el) => (el as HTMLElement).offsetParent !== null) ?? els[0];
    if (!target) {
      if (tries > 0) {
        highlightTimers.push(window.setTimeout(() => highlight(field, tries - 1), 120));
      }
      return;
    }
    target.classList.add("s-field-selected");
  }

  function applyHighlights() {
    clearHighlight();
    const cur = currentSlide();
    for (const t of selectedTargets) {
      if (t.slide === cur && t.field) highlight(t.field);
    }
  }

  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window.parent) return;
    const data = e.data as {
      type?: string;
      slide?: number | null;
      field?: string | null;
      targets?: { slide?: number; field?: string | null }[];
    };
    if (data?.type !== "mind-slides:focus") return;
    selectedTargets = Array.isArray(data.targets)
      ? data.targets
          .filter((t) => typeof t?.slide === "number" && t.slide >= 1)
          .map((t) => ({ slide: t.slide as number, field: t.field ?? null }))
      : typeof data.slide === "number" && data.slide >= 1
        ? [{ slide: data.slide, field: data.field ?? null }]
        : [];
    if (typeof data.slide === "number" && data.slide >= 1 && currentSlide() !== data.slide) {
      ctx?.router?.replace?.(`/${data.slide}`);
    }
    applyHighlights();
  });

  // ---- iframe → studio: report the deck's real position ----------------------

  function postSlide(path: string) {
    const slide = Number(path.match(/\/(\d+)/)?.[1]);
    if (Number.isInteger(slide) && slide >= 1) {
      window.parent.postMessage({ type: "mind-slides:slide", slide }, "*");
    }
  }
  ctx?.router?.afterEach?.((to) => {
    postSlide(to.path);
    // Arrowing onto a slide with selected elements repaints their outlines.
    applyHighlights();
  });
  postSlide(location.pathname);

  window.parent.postMessage({ type: "mind-slides:ready" }, "*");
}
