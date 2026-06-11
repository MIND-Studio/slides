# mind-slides-v0

**Agentic slide generation.** Describe a deck; an agent fills a *controlled set*
of slide blocks; a serializer turns the validated spec into a
[Slidev](https://sli.dev) presentation. No hand-written CSS — and your decks
live in your Solid pod.

> Part of the `mind-prototypes/` fleet. Independent app, own ports, own data.
> See `AGENTS.md` for the rules that define this prototype.

## How it works

```
brief → /api/generate → DeckSpec (Zod-validated) → serializeDeck() → slides.md
      → Slidev sidecar (:3101) → iframe in the studio (:3100)
```

- **Ten controlled blocks** — `title, section, hero, bigNumber, comparison,
  quote, imageFocus, timeline, agenda, content`. Each is a fixed, token-driven
  Vue layout. The agent fills them; it never authors layout.
- **The spec is the only contract.** `src/lib/spec/schema.ts` (Zod) →
  `serialize.ts` (the sole path to Markdown). Generation is forced to conform via
  Anthropic structured outputs.
- **Iterate, don't regenerate** — once a deck is live, the same text box
  refines it ("make slide 3 punchier", "add a quote", "remove slide 2"); the
  current spec is sent along and edited in place. A "New deck" pill starts over.
- **Multi-theme** — `mind` (cinematic cyan-on-black) and `arctic` (ice-blue).
  Click a theme pill and the active deck reskins instantly; every block
  restyles from tokens.
- **Pod-backed** — saved decks go to `<pod>/mind-slides/decks/`, written
  directly from your browser. No Mind server sees them. Re-saving a deck you
  opened from the pod updates it in place; deletes ask first.
- **Export** — download the active deck's Slidev Markdown from the preview bar.

## Run it

Two terminals:

```bash
npm install
tsx scripts/build-active.ts   # seed slidev/slides.md with the block gallery

# terminal 1 — the renderer
npm run slidev                # Slidev sidecar on :3101

# terminal 2 — the app
npm run dev                   # Next.js studio on :3100
```

Open <http://localhost:3100/studio>, type a brief, hit **Generate**, watch the
deck render. (Generation works without signing in.)

### Generation key (optional)

Two providers, pick either (server-side only — see `.env.example`):

- `ANTHROPIC_API_KEY` — first-party `claude-opus-4-8` with adaptive thinking.
- `OPENROUTER_API_KEY` (+ optional `OPENROUTER_MODEL`, default
  `anthropic/claude-sonnet-4.6`) — any model behind OpenRouter's
  OpenAI-compatible API.

Both enforce the same DeckSpec schema via structured outputs; when both keys
are set, Anthropic wins (`GENERATION_PROVIDER` pins one). **Without any key**,
a deterministic local composer produces a valid deck from your brief — the
whole loop still works offline.

### Saving to a pod (optional)

```bash
docker compose up -d          # local CSS on :3102
npm run seed:demo             # write the example decks to alice's pod
```

Then **Connect a pod** in the studio and use the pod deck library.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # spec pipeline smoke tests (offline — no key, no pod)
npm run build       # Next production build
```

## Production (Docker)

The `Dockerfile` builds two images off one deps stage — `web` (the studio,
Next standalone) and `slidev` (the render sidecar). They share the active deck
through a volume; the sidecar repaints on every write, exactly like dev.

```bash
# NODE_AUTH_TOKEN = a GitHub Packages read token (for @mind-studio/*)
NODE_AUTH_TOKEN=ghp_... docker compose -f docker-compose.prod.yml up --build
```

`NEXT_PUBLIC_*` values are baked at build time — override the build args in
`docker-compose.prod.yml` when not deploying to localhost. `ANTHROPIC_API_KEY`
is runtime-only and never reaches the browser.

## Ports

| Service          | Port |
|------------------|------|
| Next.js dev      | 3100 |
| Slidev sidecar   | 3101 |
| CSS pod (opt-in) | 3102 |

## Out of scope for v0

PPTX export · Framer Motion · concurrent multi-user rendering · `slidev build`
snapshots to the pod · local (non-Anthropic) generation model. All are
documented follow-ups.
