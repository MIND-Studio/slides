<template>
  <div class="slidev-layout">
    <div class="s-bracket tl" />
    <div class="s-bracket br" />
    <div class="s-root s-rise">
      <div v-if="$frontmatter.data.kicker" class="s-kicker" data-s-field="kicker">{{ $frontmatter.data.kicker }}</div>
      <h1 class="s-cover-title" data-s-field="title">{{ $frontmatter.data.title }}</h1>
      <p v-if="$frontmatter.data.subtitle" class="s-sub s-cover-sub" data-s-field="subtitle">{{ $frontmatter.data.subtitle }}</p>
    </div>
  </div>
</template>

<style scoped>
.s-cover-title {
  font-size: 3.7rem;
  font-weight: 680;
  line-height: 1.08;
  letter-spacing: -0.02em;
  margin: 0;
  padding-bottom: 0.12em;
  /* A bright band sweeps slowly across the title text — a living sheen. */
  background: linear-gradient(
    110deg,
    var(--s-ink) 18%,
    var(--s-accent-bright) 42%,
    var(--s-ink) 66%
  );
  background-size: 240% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: s-sheen 7s ease-in-out infinite;
}
@keyframes s-sheen {
  0% { background-position: 140% 0; }
  100% { background-position: -40% 0; }
}
.s-cover-sub { font-size: 1.35rem; max-width: 48ch; margin-top: 1.4rem; }
@media (prefers-reduced-motion: reduce) {
  .s-cover-title { animation: none; background-position: 50% 0; }
}
</style>
