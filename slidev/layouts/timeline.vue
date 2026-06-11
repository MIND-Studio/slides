<template>
  <div class="slidev-layout">
    <div class="s-root s-rise">
      <h2 v-if="$frontmatter.data.title" class="s-title s-tl-title" data-s-field="title">{{ $frontmatter.data.title }}</h2>
      <div class="s-tl" data-s-field="items">
        <div v-for="(item, i) in $frontmatter.data.items" :key="i" class="s-tl-item">
          <div class="s-tl-node" />
          <div class="s-tl-date">{{ item.date }}</div>
          <div class="s-tl-label">{{ item.label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.s-tl-title { font-size: 2.2rem; margin-bottom: 1.8rem; }
.s-tl {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 1.2rem;
  position: relative;
}
.s-tl::before {
  content: "";
  position: absolute;
  top: 6px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--s-line);
}
.s-tl-item { position: relative; padding-top: 1.6rem; }
.s-tl-node {
  position: absolute;
  top: 0;
  left: 0;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--s-accent);
  box-shadow: 0 0 0.7em var(--s-accent);
}
.s-tl-date {
  font-family: var(--s-font-mono);
  font-size: 0.95rem;
  color: var(--s-accent-bright);
  margin-bottom: 0.4rem;
}
.s-tl-label { font-size: 1.05rem; line-height: 1.4; color: var(--s-ink); padding-right: 0.8rem; }
</style>
