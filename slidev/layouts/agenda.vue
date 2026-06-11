<template>
  <div class="slidev-layout">
    <div class="s-root s-rise">
      <div class="s-kicker">Agenda</div>
      <h2 class="s-title s-ag-title" data-s-field="title">{{ $frontmatter.data.title || "What we'll cover" }}</h2>
      <ol class="s-ag-list" data-s-field="items">
        <li v-for="(item, i) in $frontmatter.data.items" :key="i" class="s-ag-item">
          <span class="s-ag-num">{{ String(i + 1).padStart(2, "0") }}</span>
          <span class="s-ag-label">{{ item }}</span>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.s-ag-title { font-size: 2.3rem; margin-bottom: 1.4rem; }
.s-ag-list { list-style: none; padding: 0; margin: 0; max-width: 40ch; }
.s-ag-item {
  display: flex;
  align-items: baseline;
  gap: 1.1rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--s-line);
}
.s-ag-num {
  font-family: var(--s-font-mono);
  font-size: 0.95rem;
  color: var(--s-accent);
  min-width: 2ch;
}
.s-ag-label { font-size: 1.3rem; }
</style>
