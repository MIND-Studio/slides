# AGENTS.md — mind-slides-v0

Orientation for agents working in this prototype. **Read this before editing.**

## Orientation

mind-slides is **agentic slide generation**. A brief becomes a polished web
presentation by filling a **controlled set of slide blocks** — never by writing
CSS/JS/layout. The pipeline is:

```
brief → /api/generate → DeckSpec (Zod-validated) → studio client state
      → DeckCanvas → deck widget (Vue, in-process) → rendered in the studio
                                                      (no sidecar, per-browser)
DeckSpec → serializeDeck() → slides.md + slidev/ project → portable Slidev deck
```

It is a **sibling** of the other prototypes — independent app, own ports, own
data, own docs. Do not unify with siblings. The grandparent
`/Users/heussers/develop/mind-experiments/CLAUDE.md` describes Mind Cube; it is
**not** relevant here.

## The one rule that defines this project

**The agent only ever emits a `DeckSpec`. There is no other authoring path.**

- `src/lib/spec/schema.ts` — the Zod `DeckSpec`: a discriminated union over ten
  block types. This is the *entire* surface a generator can touch.
- `src/lib/spec/serialize.ts` — the **only** function that turns a DeckSpec into
  Slidev Markdown. Block fields are passed to Vue layouts as **one namespaced
  frontmatter key, `data`** (encoded with `JSON.stringify`, which is valid YAML).
  Namespacing is load-bearing: a block field named `title`/`class`/`transition`
  would otherwise collide with Slidev's reserved frontmatter keys.
- `slidev/layouts/*.vue` — the ten fixed layouts. Each reads only
  `$frontmatter.data.*` and **design tokens** (`slidev/styles/tokens.css`). No
  per-slide bespoke CSS, ever. This is what makes "no arbitrary CSS/JS" true.

If you want a new visual capability, add a **block** (schema + serializer pass-
through is automatic + a layout), not an escape hatch. Never let free-form HTML
or styles reach the renderer.

## Rendering = a Vue widget, in-process (multi-user safe)

The studio renders the active deck **in the browser**, not via a Slidev sidecar.
`widget/` is a tiny Vue app — `DeckRenderer.vue` + the **same** ten
`slidev/layouts/*.vue` — built by `widget/vite.config.ts` (`@vitejs/plugin-vue`)
into a single self-contained bundle `public/deck-widget/deck-widget.{js,css}`
that attaches `window.MindDeck`. `src/components/DeckCanvas.tsx` loads that
static asset and calls `MindDeck.mount(el, { deck, ... })`; the layouts read
`$frontmatter.data.*` exactly as under Slidev (we expose a reactive
`$frontmatter` as a Vue app global, see `widget/main.ts`), so the files stay
byte-for-byte valid Slidev layouts. The widget is rebuilt by the `predev` /
`prebuild` npm hooks — run `npm run build:widget` after editing anything under
`widget/` or `slidev/layouts/`.

Because each browser renders its own deck from client state, there is **no
shared `slides.md` and no shared process** — concurrent users no longer clobber
each other (the old sidecar's core limitation). `/api/generate` returns a spec
and writes nothing server-side. Click-to-select is a plain DOM event in the
widget — no cross-origin postMessage.

`serializeDeck()` still produces `slides.md`, and the `slidev/` folder is still
a real Slidev project — that is the **portability path**: a deck (`slides.md` +
the `slidev/` project) runs/`build`s/`export`s under stock Slidev outside Mind.
The `npm run slidev` sidecar (:3161) is now **optional** — only for opening a
deck in the full Slidev app. Do not reintroduce a central per-request renderer.

## Export & publish — the stateless build worker

Real `slidev export` (PDF, via Chromium) and `slidev build` (static SPA) **can't
run in the browser** — they need Node + Chromium. `worker/server.mjs` is a tiny,
**stateless, credential-free** HTTP service that runs them:

- `POST /export {slidesMd}` → PDF bytes; `POST /build {slidesMd, base}` → a JSON
  manifest `{files:[{path, base64, contentType}]}`; `GET /healthz`.
- Every request gets its **own temp project dir** under `.work/` (a copy of the
  committed `slidev/` project + the posted `slides.md`) — the shared
  `slidev/slides.md` is never written, so it's multi-user safe like the preview.
  It `rm -rf`s the dir after each request and holds **no pod credentials**.
- The browser calls it through the same-origin `src/app/api/render/route.ts`
  proxy (forwards to `RENDER_WORKER_URL`, default `http://localhost:3162`); the
  worker stays on the internal network. `src/lib/publish/render-client.ts` wraps
  the two calls.

**The browser uploads the artifacts to the pod**, preserving the
browser-talks-to-pod invariant: `savePdf` (`deck-store.ts`) writes
`decks/<id>/deck.pdf`; `publishSite` (`src/lib/solid/site-store.ts`) uploads the
SPA to `<pod>/mind-slides/sites/<id>/` with per-file content-types, and — when
the user picks **public** — `src/lib/solid/acl.ts` writes a WAC `.acl` granting
`foaf:Agent` read on the container **and** its contents (both needed, else the
assets 403). `slidev build --base` is the pod URL **path** (`siteBaseForId`) so
assets resolve; one build per deck avoids slidevjs/slidev#2368.

This is the one place a deck transits a Mind server — transiently, with no
credentials and nothing persisted (same class as the brief already going to
Anthropic during generation). Run the worker with `npm run worker`.

**Note on the pod link:** Community Solid Server returns an RDF listing on a
container GET, so the shareable URL is `.../sites/<id>/index.html`, not the bare
container.

## Generation

`/api/generate` (Node runtime) handles **two kinds of turn** on one endpoint:
a fresh brief, and a **revision** (body carries `currentDeck` + the brief is
an instruction like "make slide 3 punchier"). Briefs are capped at 4000 chars.

- With `ANTHROPIC_API_KEY`: Claude **`claude-opus-4-8`** with
  `thinking: {type: "adaptive"}` + GA structured outputs —
  `client.messages.parse()` with `output_config.format:
  zodOutputFormat(deckSchema)` — so the model is *forced* to return a
  conforming spec. (Not the old beta `output_format`; that surface is
  deprecated.) The brief IS sent to Anthropic — this is the authoring tool,
  not pod-data egress.
- With `OPENROUTER_API_KEY` (`src/lib/generate/openrouter.ts`): any OpenRouter
  model via the OpenAI-compatible API — plain `fetch`, **no extra SDK** —
  with the same schema enforced via `response_format: json_schema`
  (`z.toJSONSchema(deckSchema)`). Model = `OPENROUTER_MODEL` (default
  `anthropic/claude-sonnet-4.6`). When both keys are set Anthropic wins;
  `GENERATION_PROVIDER=anthropic|openrouter` pins one.
- Without a key: deterministic local fallbacks in `src/lib/spec/compose.ts` —
  `composeDeck` for briefs, `reviseDeck` for revisions. Same validate +
  serialize path, so the loop works offline. **Keep these fallbacks** — they
  are how the prototype is testable without a key (`npm test` exercises them).

Whatever a generation returns is **re-validated** (`validateDeck`) before it is
trusted or serialized. Never skip that.

## Pod storage — the browser talks directly to the pod

`src/lib/solid/deck-store.ts` is **client-side**. Decks save to
`<pod>/mind-slides/decks/<id>/` (`deck.json` source of truth + `slides.md` +
`meta.json`) via the authenticated browser session. **No Mind server ever sees
your decks.** There is intentionally no `/api/decks` route — adding one would
break this invariant. Signing in is optional and only gates *saving*.

## NOT the Next.js / Solid you know

Next.js **16.2.6** + React **19.2.4** — read `node_modules/next/dist/docs/` for
the current API rather than training-cutoff memory. Solid: CSS v7, WAC by
default, OIDC via `@inrupt/solid-client-authn-*`; the single-flight
`handleIncomingRedirect` in `auth.ts` is the double-redeem fix — don't undo it.

## Ports

| Service           | Port |
|-------------------|------|
| Next.js dev       | 3160 |
| Build/export worker | 3162 |
| Slidev sidecar (optional) | 3161 |
| Shared pod (mind-node) | 3011 |

`npm run dev` is enough for authoring (it builds the deck widget first via
`predev`). To use **Export PDF / Publish site**, also run `npm run worker`
(:3162) — the studio's `/api/render` proxy forwards to it. The `npm run slidev`
sidecar is optional — only to view a deck in the full Slidev app.

## Checks before handing off

```bash
npm run build:widget # rebuild the in-app deck renderer (widget/ → public/deck-widget)
npm run typecheck   # tsc --noEmit (the widget is typechecked by its own tsconfig)
npm test            # scripts/smoke.ts — spec pipeline invariants (no key, no pod needed)
npm run build       # Next production build (standalone; prebuild runs build:widget)
```

## Never commit

- `.css-data/` — pod contents
- `.next/` — Next.js cache (wipe with `rm -rf .next` if Turbopack serves stale CSS)
- `node_modules/`, `.env*.local`

## Ask before doing

- Adding any server-side persistence or a `/api/decks` route (breaks the
  browser-talks-to-pod invariant).
- Introducing free-form HTML/CSS/JS into the generation or serialization path.
- Adding Framer Motion or PPTX export (both are explicit v0 non-goals — motion
  comes from Slidev/CSS/Vue only).
- Touching sibling prototypes.
