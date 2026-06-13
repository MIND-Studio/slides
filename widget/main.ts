/**
 * The deck widget's public API. Built by Vite into a single IIFE bundle
 * (`public/deck-widget/deck-widget.js`) that attaches `window.MindDeck`, plus
 * `deck-widget.css`. The Next/React studio loads those static assets and calls
 * `mount()` — no Slidev sidecar, no shared slides.md, no Vue in Next's bundler.
 * Each browser renders its own deck, which is what makes it multi-user safe.
 */
import { createApp, reactive } from "vue";
import DeckRenderer from "./DeckRenderer.vue";
import PrintSlide from "./PrintSlide.vue";
import "./styles.css";

export interface Target {
  slide: number;
  field?: string | null;
}

export interface MountProps {
  deck: unknown;
  activeSlide?: number;
  /** Studio editing mode — enables hover affordance + click-to-select. */
  embedded?: boolean;
  targets?: Target[];
  onSelect?: (payload: { slide: number; field: string | null; meta: boolean }) => void;
}

export interface DeckController {
  update(props: Partial<MountProps>): void;
  /** Render every slide to a print sheet and open the browser print dialog
   *  ("Save as PDF"). Fully client-side — no server, no deck egress. */
  exportPdf(): void;
  destroy(): void;
}

export function mount(el: HTMLElement, props: MountProps): DeckController {
  const state = reactive({
    deck: props.deck as Record<string, unknown> | null,
    activeSlide: props.activeSlide ?? 1,
    embedded: props.embedded ?? false,
    targets: props.targets ?? ([] as Target[]),
  });

  // Shared, reactive `$frontmatter` the layouts read (`$frontmatter.data.*`).
  // DeckRenderer rewrites `.data` to the active slide.
  const frontmatter = reactive<{ data: Record<string, unknown> }>({ data: {} });
  let onSelect = props.onSelect;

  const app = createApp(DeckRenderer, {
    state,
    onSelect: (payload: { slide: number; field: string | null; meta: boolean }) =>
      onSelect?.(payload),
  });
  app.config.globalProperties.$frontmatter = frontmatter;
  app.provide("mind:frontmatter", frontmatter);
  app.mount(el);

  return {
    update(next) {
      if (next.deck !== undefined) state.deck = next.deck as Record<string, unknown> | null;
      if (next.activeSlide !== undefined) state.activeSlide = next.activeSlide;
      if (next.embedded !== undefined) state.embedded = next.embedded;
      if (next.targets !== undefined) state.targets = next.targets;
      if (next.onSelect !== undefined) onSelect = next.onSelect;
    },
    exportPdf() {
      const deck = state.deck as { theme?: string; slides?: Array<Record<string, unknown>> } | null;
      const slides = deck?.slides;
      if (!slides?.length) return;

      // Build a body-level print sheet: one app per slide, each with its OWN
      // reactive `$frontmatter`, so all slides render at once (the live renderer
      // shares a single frontmatter and can only show one slide at a time).
      const root = document.createElement("div");
      root.className = "deck-print-root";
      const palette = `palette-${deck?.theme ?? "mind"}`;
      const apps: Array<{ unmount(): void }> = [];

      for (const s of slides) {
        const page = document.createElement("div");
        page.className = "deck-print-page";
        const surface = document.createElement("div");
        surface.className = `deck-print-canvas ${palette}`;
        page.appendChild(surface);
        root.appendChild(page);

        const fm = reactive<{ data: Record<string, unknown> }>({ data: {} });
        const { block: _block, ...data } = s;
        fm.data = data;
        const slideApp = createApp(PrintSlide, { slide: s });
        slideApp.config.globalProperties.$frontmatter = fm;
        slideApp.provide("mind:frontmatter", fm);
        slideApp.mount(surface);
        apps.push(slideApp);
      }

      document.body.appendChild(root);
      document.body.classList.add("deck-printing");

      const cleanup = () => {
        window.removeEventListener("afterprint", cleanup);
        apps.forEach((a) => a.unmount());
        root.remove();
        document.body.classList.remove("deck-printing");
      };
      window.addEventListener("afterprint", cleanup);
      // Two frames: let Vue paint the mounted slides before the print dialog
      // snapshots the page.
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    },
    destroy() {
      app.unmount();
    },
  };
}
