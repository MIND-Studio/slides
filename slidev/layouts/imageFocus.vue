<template>
  <div class="slidev-layout s-img-layout">
    <div class="s-img-figure">
      <img :src="$frontmatter.data.image" class="s-img" data-s-field="image" />
      <div class="s-img-scrim" />
    </div>
    <div class="s-img-caption s-rise">
      <h2 v-if="$frontmatter.data.title" class="s-img-title" data-s-field="title">{{ $frontmatter.data.title }}</h2>
      <p v-if="$frontmatter.data.caption" class="s-sub" data-s-field="caption">{{ $frontmatter.data.caption }}</p>
    </div>
  </div>
</template>

<style scoped>
.s-img-layout { padding: 0; position: relative; overflow: hidden; }
.s-img-figure { position: absolute; inset: 0; }
.s-img { width: 100%; height: 100%; object-fit: cover; }
.s-img-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--s-bg) 0%, color-mix(in srgb, var(--s-bg) 55%, transparent) 42%, transparent 75%),
    linear-gradient(0deg, var(--s-bg) 0%, transparent 40%);
}
.s-img-caption {
  position: absolute;
  left: 4rem;
  bottom: 3.2rem;
  max-width: 40ch;
  z-index: 1;
}
.s-img-title { font-size: 2.4rem; font-weight: 660; margin: 0 0 0.5rem; letter-spacing: -0.01em; }
</style>
