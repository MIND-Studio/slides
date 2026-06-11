<template>
  <div class="slidev-layout">
    <div class="s-root s-rise">
      <div v-if="$frontmatter.data.kicker" class="s-kicker" data-s-field="kicker">{{ $frontmatter.data.kicker }}</div>
      <h2 class="s-title s-content-title" data-s-field="title">{{ $frontmatter.data.title }}</h2>
      <!-- The block's bullets arrive as a real Markdown list in the slide
           body and are styled by base.css. -->
      <div data-s-field="bullets">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.s-content-title { font-size: 2.4rem; }
</style>
