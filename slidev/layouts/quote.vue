<template>
  <div class="slidev-layout">
    <div class="s-root s-rise s-quote">
      <div class="s-quote-mark">&ldquo;</div>
      <blockquote class="s-quote-text" data-s-field="text">{{ $frontmatter.data.text }}</blockquote>
      <div v-if="$frontmatter.data.attribution" class="s-quote-by" data-s-field="attribution">— {{ $frontmatter.data.attribution }}</div>
    </div>
  </div>
</template>

<style scoped>
.s-quote { align-items: flex-start; }
.s-quote-mark {
  font-family: var(--s-font-mono);
  font-size: 6rem;
  line-height: 0.5;
  color: var(--s-accent);
  opacity: 0.55;
  margin-bottom: 0.4rem;
}
.s-quote-text {
  font-size: 2.3rem;
  font-weight: 550;
  line-height: 1.3;
  letter-spacing: -0.01em;
  max-width: 22ch;
  margin: 0;
  border: 0;
  padding: 0;
}
.s-quote-by {
  margin-top: 1.6rem;
  font-family: var(--s-font-mono);
  font-size: 1rem;
  color: var(--s-muted);
}
</style>
