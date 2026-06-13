<script setup lang="ts">
/**
 * One slide, rendered standalone for the print sheet (Export PDF). Unlike
 * DeckRenderer (which swaps the active slide through a single shared
 * `$frontmatter`), every print slide is its own Vue app with its OWN
 * `$frontmatter` global — see main.ts `exportPdf()` — so all slides can be laid
 * out on the page at once, each reading its own `$frontmatter.data.*` exactly as
 * the layouts do under Slidev. The data is set on the per-app global before
 * mount; this component only picks the layout and supplies the content slot.
 */
import { computed } from "vue";
import { LAYOUTS, type BlockName } from "./layouts";

const props = defineProps<{ slide: Record<string, unknown> }>();
const layout = computed(() => LAYOUTS[props.slide.block as BlockName] ?? null);
</script>

<template>
  <component :is="layout" v-if="layout">
    <!-- Mirror DeckRenderer: the `content` block renders its bullets as the
         layout's default slot so base.css styles them identically. -->
    <template v-if="(slide as any).block === 'content'">
      <ul>
        <li v-for="(b, i) in (slide as any).bullets" :key="i">{{ b }}</li>
      </ul>
    </template>
  </component>
</template>
