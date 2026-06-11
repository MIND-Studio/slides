# AGENTS.md — mind-slides-v0

Orientation for agents working in this prototype. **Read this before editing.**

## Orientation

mind-slides is **agentic slide generation**. A brief becomes a polished web
presentation by filling a **controlled set of slide blocks** — never by writing
CSS/JS/layout. The pipeline is:

```
brief → /api/generate → DeckSpec (Zod-validated) → serializeDeck() → slides.md
      → Slidev sidecar (:3101) → iframe in the studio (:3100)
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

## Rendering = a sidecar, not in-process

Slidev is a Vite/Vue app; it **cannot** embed in Next. `npm run slidev` runs it
as a separate process on :3101 serving the single file `slidev/slides.md`.
"Make a deck active" = overwrite that file (`src/lib/slidev/workspace.ts`,
path overridable via `SLIDES_PATH` for containers); Slidev HMR repaints the
studio iframe. In the Docker stack (`docker-compose.prod.yml`) the two
containers share the file through a volume — same mechanism, containerized.
**v0 limitation:** one active deck at a time, single local user. Concurrent
multi-deck rendering and `slidev build` snapshots-to-pod are explicit later
work — do not add a central renderer.

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
| Slidev sidecar    | 3161 |
| Shared pod (mind-node) | 3011 |

Run `npm run slidev` and `npm run dev` in two terminals.

## Checks before handing off

```bash
npm run typecheck   # tsc --noEmit
npm test            # scripts/smoke.ts — spec pipeline invariants (no key, no pod needed)
npm run build       # Next production build (standalone)
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
