// The block → layout map. These are the SAME ten `.vue` layouts the standalone
// Slidev project renders (slidev/layouts/*.vue) — imported here and compiled by
// this widget's Vite build (@vitejs/plugin-vue). One layout source of truth
// feeds both the in-app preview and any exported standalone Slidev deck.
import agenda from "../slidev/layouts/agenda.vue";
import bigNumber from "../slidev/layouts/bigNumber.vue";
import comparison from "../slidev/layouts/comparison.vue";
import content from "../slidev/layouts/content.vue";
import hero from "../slidev/layouts/hero.vue";
import imageFocus from "../slidev/layouts/imageFocus.vue";
import quote from "../slidev/layouts/quote.vue";
import section from "../slidev/layouts/section.vue";
import timeline from "../slidev/layouts/timeline.vue";
import title from "../slidev/layouts/title.vue";

export const LAYOUTS = {
  title,
  section,
  hero,
  bigNumber,
  comparison,
  quote,
  imageFocus,
  timeline,
  agenda,
  content,
} as const;

export type BlockName = keyof typeof LAYOUTS;
