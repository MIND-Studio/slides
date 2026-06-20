<script setup lang="ts">
/**
 * The in-app deck surface. Renders ONE slide of a DeckSpec at a time by
 * dynamically mounting the matching layout (`slidev/layouts/<block>.vue`) inside
 * a fixed 980×551.25 canvas that is CSS-scaled to fit the viewport — the same
 * scale-to-fit trick Slidev's own SlideContainer uses, so a slide looks
 * identical here and in an exported standalone deck.
 *
 * The layouts read their content from `$frontmatter.data.*` (exactly as under
 * Slidev). We satisfy that by exposing a reactive `$frontmatter` as an app
 * global (see main.ts) and rewriting `.data` to the active slide here — so the
 * layout files stay byte-for-byte valid Slidev layouts.
 */
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchEffect,
} from "vue";
import { type BlockName, LAYOUTS } from "./layouts";

interface Target {
  slide: number;
  field?: string | null;
}
interface DeckState {
  deck: { theme?: string; slides?: Array<Record<string, unknown>> } | null;
  activeSlide: number;
  embedded: boolean;
  targets: Target[];
}

const props = defineProps<{ state: DeckState }>();
const emit =
  defineEmits<
    (e: "select", payload: { slide: number; field: string | null; meta: boolean }) => void
  >();

// Slidev's default canvas (canvasWidth 980, aspectRatio 16/9). The layouts' rem
// sizing is tuned for this exact canvas at the document's 16px root — we scale
// by transform only (never font-size), so those values stay in parity.
const CANVAS_W = 980;
const CANVAS_H = 551.25;

const frontmatter = inject<{ data: Record<string, unknown> }>("mind:frontmatter")!;

const slide = computed(
  () => props.state.deck?.slides?.[(props.state.activeSlide ?? 1) - 1] ?? null,
);
const layout = computed(() =>
  slide.value ? (LAYOUTS[slide.value.block as BlockName] ?? null) : null,
);
const paletteClass = computed(() => `palette-${props.state.deck?.theme ?? "mind"}`);

// Feed the active slide's fields to the layouts via the shared `$frontmatter`.
// Runs pre-render (default watcher flush), so the keyed re-mount below reads the
// fresh data.
watchEffect(() => {
  const s = slide.value;
  if (!s) {
    frontmatter.data = {};
    return;
  }
  const { block: _block, ...data } = s;
  frontmatter.data = data;
});

// ---- scale-to-fit ---------------------------------------------------------
const viewport = ref<HTMLElement>();
const canvas = ref<HTMLElement>();
const scale = ref(1);
let ro: ResizeObserver | undefined;

function recompute() {
  const el = viewport.value;
  if (!el || !el.clientWidth || !el.clientHeight) return;
  const s = Math.min(el.clientWidth / CANVAS_W, el.clientHeight / CANVAS_H);
  scale.value = s > 0 ? s : 1;
}
onMounted(() => {
  recompute();
  ro = new ResizeObserver(recompute);
  if (viewport.value) ro.observe(viewport.value);
});
onBeforeUnmount(() => ro?.disconnect());

const canvasStyle = computed(() => ({
  width: `${CANVAS_W}px`,
  height: `${CANVAS_H}px`,
  transform: `translate(-50%, -50%) scale(${scale.value})`,
}));

// ---- click-to-select (studio editing bridge, now in-process) --------------
function onClick(e: MouseEvent) {
  if (!props.state.embedded) return;
  const fieldEl = (e.target as HTMLElement).closest?.("[data-s-field]") as HTMLElement | null;
  emit("select", {
    slide: props.state.activeSlide,
    field: fieldEl?.dataset.sField ?? null,
    meta: e.metaKey || e.ctrlKey,
  });
}

// ---- persistent selection outline -----------------------------------------
function applyHighlights() {
  const root = canvas.value;
  if (!root) return;
  root
    .querySelectorAll(".s-field-selected")
    .forEach((el) => el.classList.remove("s-field-selected"));
  const cur = props.state.activeSlide;
  for (const t of props.state.targets ?? []) {
    if (t.slide === cur && t.field) {
      root
        .querySelectorAll(`[data-s-field="${t.field}"]`)
        .forEach((el) => el.classList.add("s-field-selected"));
    }
  }
}
watch(
  () => [props.state.targets, props.state.activeSlide, slide.value] as const,
  () => nextTick(applyHighlights),
  { deep: true },
);
onMounted(() => nextTick(applyHighlights));
</script>

<template>
  <div ref="viewport" class="deck-viewport" @click="onClick">
    <div
      ref="canvas"
      class="deck-canvas"
      :class="[paletteClass, { 's-embedded': state.embedded }]"
      :style="canvasStyle"
    >
      <component :is="layout" v-if="layout" :key="state.activeSlide">
        <!-- The `content` block renders its bullets from the slide BODY in
             Slidev (a Markdown list → <slot/>). In-app we supply the same list
             as slot content so base.css styles it identically. -->
        <template v-if="slide && (slide as any).block === 'content'">
          <ul>
            <li v-for="(b, i) in (slide as any).bullets" :key="i">{{ b }}</li>
          </ul>
        </template>
      </component>
    </div>
  </div>
</template>

<style>
.deck-viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #000;
}
.deck-canvas {
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: center center;
  overflow: hidden;
  border-radius: 2px;
}
/* The layout root fills the fixed canvas (Slidev's wrapper normally sizes it). */
.deck-canvas > .slidev-layout {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
