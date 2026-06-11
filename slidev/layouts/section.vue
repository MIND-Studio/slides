<template>
  <div class="slidev-layout s-section">
    <div class="s-bracket tl" />
    <div class="s-bracket br" />
    <div class="s-root s-rise">
      <div v-if="$frontmatter.data.kicker" class="s-kicker" data-s-field="kicker">{{ $frontmatter.data.kicker }}</div>
      <h1 class="s-section-title" data-s-field="title">{{ $frontmatter.data.title }}</h1>
      <p v-if="$frontmatter.data.note" class="s-sub" data-s-field="note">{{ $frontmatter.data.note }}</p>
      <div class="s-section-rule" />
    </div>
  </div>
</template>

<style scoped>
.s-section { }
.s-section-title {
  font-size: 4.2rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1;
  margin: 0;
}
.s-section-rule {
  margin-top: 1.6rem;
  width: 5.5rem;
  height: 3px;
  border-radius: 2px;
  background: var(--s-accent);
  box-shadow: 0 0 1.2em var(--s-accent);
  /* Sweeps out from the left, then pulses. */
  transform-origin: left center;
  animation:
    s-rule-grow 0.8s 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) both,
    s-rule-glow 3s ease-in-out 1.1s infinite;
}
@keyframes s-rule-grow {
  from { transform: scaleX(0); opacity: 0; }
  to { transform: scaleX(1); opacity: 1; }
}
@keyframes s-rule-glow {
  0%, 100% { box-shadow: 0 0 0.9em var(--s-accent); }
  50% { box-shadow: 0 0 1.9em var(--s-accent); }
}
@media (prefers-reduced-motion: reduce) {
  .s-section-rule { animation: none; transform: none; }
}
</style>
