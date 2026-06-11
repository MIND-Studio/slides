<template>
  <div class="slidev-layout">
    <div class="s-root s-rise">
      <h2 v-if="$frontmatter.data.title" class="s-title s-cmp-title" data-s-field="title">{{ $frontmatter.data.title }}</h2>
      <div class="s-cmp-grid">
        <!-- Optional chaining: during an HMR transition Slidev can briefly feed
             this component another block's `data`; a throw here aborts the whole
             patch and strands the deck on stale content. -->
        <div class="s-panel s-cmp-col" data-s-field="left">
          <div class="s-cmp-head">{{ $frontmatter.data.left?.heading }}</div>
          <ul class="s-cmp-list">
            <li v-for="(p, i) in $frontmatter.data.left?.points" :key="i">{{ p }}</li>
          </ul>
        </div>
        <div class="s-cmp-vs">vs</div>
        <div class="s-panel s-cmp-col s-cmp-col-accent" data-s-field="right">
          <div class="s-cmp-head s-accent">{{ $frontmatter.data.right?.heading }}</div>
          <ul class="s-cmp-list">
            <li v-for="(p, i) in $frontmatter.data.right?.points" :key="i">{{ p }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.s-cmp-title { font-size: 2.2rem; margin-bottom: 1.6rem; }
.s-cmp-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  gap: 1.4rem;
}
.s-cmp-col { display: flex; flex-direction: column; }
.s-cmp-col-accent {
  border-color: var(--s-accent);
  box-shadow: 0 0 0 1px var(--s-accent), 0 0 2.4em -1.2em var(--s-accent);
  animation: s-card-glow 3.6s ease-in-out infinite;
}
@keyframes s-card-glow {
  0%, 100% { box-shadow: 0 0 0 1px var(--s-accent), 0 0 2.4em -1.2em var(--s-accent); }
  50% { box-shadow: 0 0 0 1px var(--s-accent-bright), 0 0 3.4em -0.6em var(--s-accent); }
}
@media (prefers-reduced-motion: reduce) {
  .s-cmp-col-accent { animation: none; }
}
.s-cmp-head {
  font-size: 1.25rem;
  font-weight: 650;
  margin-bottom: 0.9rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid var(--s-line);
}
.s-cmp-vs {
  align-self: center;
  font-family: var(--s-font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--s-muted);
}
.s-cmp-list { list-style: none; padding: 0; margin: 0; }
.s-cmp-list li {
  position: relative;
  padding-left: 1.3rem;
  margin: 0.55rem 0;
  font-size: 1.05rem;
  line-height: 1.4;
}
.s-cmp-list li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 2px;
  background: var(--s-accent);
}
</style>
