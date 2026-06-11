<template>
  <div class="slidev-layout">
    <div class="s-root s-rise s-bn">
      <div class="s-bn-value" data-s-field="value">{{ $frontmatter.data.value }}</div>
      <div class="s-bn-label" data-s-field="label">{{ $frontmatter.data.label }}</div>
      <p v-if="$frontmatter.data.caption" class="s-sub s-bn-caption" data-s-field="caption">{{ $frontmatter.data.caption }}</p>
    </div>
  </div>
</template>

<style scoped>
.s-bn { align-items: flex-start; }
.s-bn-value {
  font-family: var(--s-font-mono);
  font-size: 9rem;
  font-weight: 600;
  line-height: 0.95;
  letter-spacing: -0.03em;
  /* Gradient glyphs that pop in, then breathe with a soft glow. */
  background: linear-gradient(180deg, var(--s-accent-bright) 0%, var(--s-accent) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 0.28em var(--s-glow));
  animation:
    s-bn-pop 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both,
    s-bn-glow 3.2s ease-in-out 0.9s infinite;
}
@keyframes s-bn-pop {
  from { opacity: 0; transform: translateY(0.12em) scale(0.92); }
  to { opacity: 1; transform: none; }
}
@keyframes s-bn-glow {
  0%, 100% { filter: drop-shadow(0 0 0.25em var(--s-glow)); }
  50% { filter: drop-shadow(0 0 0.85em var(--s-glow)); }
}
@media (prefers-reduced-motion: reduce) {
  .s-bn-value { animation: none; }
}
.s-bn-label {
  font-size: 1.7rem;
  font-weight: 600;
  margin-top: 0.6rem;
  max-width: 24ch;
}
.s-bn-caption { font-size: 1.15rem; max-width: 44ch; }
</style>
