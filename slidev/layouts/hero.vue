<template>
  <div class="slidev-layout">
    <div class="s-root s-rise">
      <div v-if="$frontmatter.data.kicker" class="s-kicker" data-s-field="kicker">{{ $frontmatter.data.kicker }}</div>
      <h1 class="s-hero-headline" data-s-field="headline">{{ $frontmatter.data.headline }}</h1>
      <p v-if="$frontmatter.data.sub" class="s-sub s-hero-sub" data-s-field="sub">{{ $frontmatter.data.sub }}</p>
      <div v-if="$frontmatter.data.cta" class="s-hero-cta" data-s-field="cta">{{ $frontmatter.data.cta }}</div>
    </div>
  </div>
</template>

<style scoped>
.s-hero-headline {
  font-size: 3.3rem;
  font-weight: 670;
  line-height: 1.1;
  letter-spacing: -0.02em;
  max-width: 18ch;
  margin: 0;
}
.s-hero-sub { font-size: 1.3rem; max-width: 46ch; }
.s-hero-cta {
  margin-top: 1.8rem;
  align-self: flex-start;
  font-family: var(--s-font-mono);
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  color: var(--s-accent-ink);
  background: var(--s-accent);
  padding: 0.7rem 1.3rem;
  border-radius: 999px;
}
</style>
