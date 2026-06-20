import type { DeckSpec } from "./schema";

/**
 * Hand-authored reference decks. `galleryDeck` exercises every controlled block
 * once — it is the default active deck the Slidev sidecar boots with and the
 * fixture the serializer is unit-checked against. The persona decks are what
 * `seed:demo` writes to a pod.
 */

export const galleryDeck: DeckSpec = {
  title: "Mind Slides — the block gallery",
  theme: "mind",
  slides: [
    {
      block: "title",
      kicker: "Mind Slides · v0",
      title: "Decks, generated.",
      subtitle:
        "An agent fills a controlled set of blocks. A serializer turns the spec into Slidev. No hand-written CSS, ever.",
    },
    {
      block: "agenda",
      items: [
        "Why a controlled block set",
        "The ten blocks",
        "Spec → Slidev pipeline",
        "Two themes, one spec",
      ],
    },
    {
      block: "section",
      kicker: "Part 01",
      title: "The big idea",
      note: "Structure beats free-form generation.",
    },
    {
      block: "hero",
      kicker: "Thesis",
      headline: "Constrain the surface, and quality stops being luck.",
      sub: "Models are great at choosing and filling blocks; they are unreliable at authoring layout from scratch.",
      cta: "Spec in → beautiful deck out",
    },
    {
      block: "bigNumber",
      value: "10",
      label: "controlled block types",
      caption: "Each one a fixed, token-driven Vue layout. The agent never writes a line of CSS.",
    },
    {
      block: "comparison",
      title: "Free-form vs. controlled",
      left: {
        heading: "Free-form HTML/CSS",
        points: ["Inconsistent", "Breaks on edge cases", "Hard to theme", "Unreviewable"],
      },
      right: {
        heading: "Controlled blocks",
        points: [
          "Consistent by design",
          "Always renders",
          "Reskins from tokens",
          "Schema-validated",
        ],
      },
    },
    {
      block: "timeline",
      title: "The pipeline",
      items: [
        { date: "01", label: "Brief" },
        { date: "02", label: "DeckSpec (validated)" },
        { date: "03", label: "Serialize" },
        { date: "04", label: "Slidev render" },
      ],
    },
    {
      block: "content",
      kicker: "How it holds",
      title: "Why the guarantee is real",
      bullets: [
        "The agent only ever emits a Zod-validated DeckSpec",
        "One serializer is the sole path to Markdown",
        "Block data is slotted into fixed layouts as frontmatter",
        "Layouts read only design tokens — no per-slide styling",
      ],
    },
    {
      block: "quote",
      text: "The best way to make generation reliable is to give it fewer, better choices.",
      attribution: "The Mind Slides design note",
    },
    {
      block: "imageFocus",
      title: "Full-bleed imagery",
      image: "https://picsum.photos/seed/mind-slides/1600/900",
      caption: "The tenth block: one featured image, captioned, no bespoke layout.",
    },
    {
      block: "section",
      kicker: "Part 02",
      title: "Same spec, any theme",
      note: "Switch the palette; every block reskins.",
    },
  ],
};

export const launchDeck: DeckSpec = {
  title: "Aurora — launch pitch",
  theme: "mind",
  slides: [
    {
      block: "title",
      kicker: "Aurora · 2026",
      title: "Your notes, finally private.",
      subtitle: "End-to-end encrypted, pod-backed, and fast.",
    },
    {
      block: "bigNumber",
      value: "0",
      label: "bytes that leave your device unencrypted",
      caption: "Everything is sealed before it touches the network.",
    },
    {
      block: "comparison",
      title: "The shift",
      left: {
        heading: "Today's apps",
        points: ["Your data on their servers", "Sold to advertisers", "Locked in"],
      },
      right: {
        heading: "Aurora",
        points: ["Your data in your pod", "Never sold", "Portable by design"],
      },
    },
    {
      block: "hero",
      headline: "Privacy you don't have to think about.",
      sub: "It's the default, not a setting you hunt for.",
      cta: "Try the beta →",
    },
    {
      block: "section",
      kicker: "End",
      title: "Own your mind.",
    },
  ],
};

export const reviewDeck: DeckSpec = {
  title: "Q2 in review",
  theme: "arctic",
  slides: [
    {
      block: "title",
      kicker: "Internal · Q2",
      title: "Where we landed.",
      subtitle: "Three numbers and what's next.",
    },
    {
      block: "bigNumber",
      value: "3.2x",
      label: "growth in active pods",
      caption: "Quarter over quarter.",
    },
    { block: "bigNumber", value: "98%", label: "of sync runs under 200ms" },
    {
      block: "timeline",
      title: "The quarter",
      items: [
        { date: "Apr", label: "Encrypted sync GA" },
        { date: "May", label: "Mobile beta" },
        { date: "Jun", label: "3.2x pods" },
      ],
    },
    {
      block: "content",
      title: "Next quarter",
      bullets: ["Ship offline-first", "Open the plugin API", "Hit 10k pods"],
    },
  ],
};

/**
 * A real showcase deck — explains the sibling `solid/solid-server-rs` project
 * (a Rust rewrite of the Community Solid Server). Facts are drawn from that
 * repo's README.md, BENCHMARK.md and VALIDATION.md, so it doubles as a demo of
 * the block set carrying genuine, dense content rather than lorem ipsum.
 */
export const solidServerRsDeck: DeckSpec = {
  title: "solid-server-rs",
  theme: "mind",
  slides: [
    {
      block: "title",
      kicker: "Mind · Solid infrastructure",
      title: "solid-server-rs",
      subtitle: "A scalable, secure Solid Personal Data Server — rewritten in Rust.",
    },
    {
      block: "agenda",
      title: "What we'll cover",
      items: [
        "What it is, and why rebuild the server",
        "How it compares to the Community Solid Server",
        "The performance story",
        "What works today (v1 MVP)",
        "Built to extend: plugins, WASM, brokered LLM",
        "Operator surfaces & the privacy boundary",
      ],
    },
    {
      block: "hero",
      kicker: "The idea",
      headline: "A pod server where DID auth and a plugin system are first-class.",
      sub: "A greenfield re-architecture of the Community Solid Server — Axum + Sophia + rustls, a single binary, passwordless did:key login native, and an extension model that's ours.",
      cta: "Point any Solid app at http://localhost:3061/ and it just works.",
    },
    {
      block: "section",
      kicker: "Part 01",
      title: "Why rebuild it?",
      note: "CSS gave us the blueprint. Rust lets us own the auth, the safety, and the speed.",
    },
    {
      block: "comparison",
      title: "Reference vs. the Rust rebuild",
      left: {
        heading: "Community Solid Server (Node.js)",
        points: [
          "Single-threaded event loop",
          "597 req/s on the fair endpoint",
          "366 MB resident memory",
          "p99 latency 188 ms",
          "Password / OIDC auth",
        ],
      },
      right: {
        heading: "solid-server-rs (Rust)",
        points: [
          "Multi-threaded tokio runtime",
          "91,980 req/s — about 154×",
          "18 MB resident — about 18× leaner",
          "p99 latency 1 ms",
          "DID passwordless auth, native",
        ],
      },
    },
    {
      block: "bigNumber",
      value: "154×",
      label: "the throughput of CSS",
      caption:
        "Identical OIDC discovery endpoint · 91,980 vs 597 req/s · Apple M3 Pro, release build",
    },
    {
      block: "content",
      kicker: "v1 MVP — working",
      title: "What works today",
      bullets: [
        "LDP CRUD with containment triples + RDF content negotiation (Turtle, N-Triples, JSON-LD)",
        "SPARQL 1.1 query (Oxigraph) and full N3 Patch + SPARQL-Update PATCH",
        "Web Access Control by default, plus Access Control Policy (--authz acp)",
        "DID auth (did:key / Ed25519): challenge → sign → verify, pod auto-provision",
        "Solid-OIDC provider — DPoP-bound tokens, PKCE, client_credentials",
        "WebSocket + WebHook notifications (Activity Streams 2.0)",
      ],
    },
    {
      block: "timeline",
      title: "What landed on the way to v1",
      items: [
        { date: "Core", label: "LDP CRUD · WAC · DID auth · Solid-OIDC" },
        { date: "RDF", label: "SPARQL query · full N3 Patch · ACP" },
        { date: "Scale", label: "Multi-pod tenancy · per-pod storage routing" },
        { date: "Extend", label: "WASM plugins · programmable pods · brokered LLM" },
        { date: "Proof", label: "Official conformance harness · S3/GCS/Azure" },
      ],
    },
    {
      block: "bigNumber",
      value: "596 / 647",
      label: "official MUST conformance scenarios",
      caption: "Solid Conformance Test Harness — the CSS/ESS/NSS certifier — running end-to-end",
    },
    {
      block: "section",
      kicker: "Part 02",
      title: "Built to extend",
      note: "A 15-crate workspace behind swappable traits — Repo, Authorizer, Notifier, LlmBroker.",
    },
    {
      block: "content",
      kicker: "The plugin model",
      title: "Beyond a data server",
      bullets: [
        "WASM plugins — run untrusted guest code in-process, sandboxed (zero ambient caps) and fuel-metered",
        "Programmable pods — upload a script, run it over HTTP within your own rights, write back in place",
        "No-build JS authoring — upload plain JavaScript, interpreted by a bundled pure-Rust Boa engine",
        "Remote object stores — S3 / GCS / Azure via OpenDAL, selectable per pod with RepoRouter",
      ],
    },
    {
      block: "content",
      kicker: "host.llm — brokered, not networked",
      title: "Agentic pods",
      bullets: [
        "A sandboxed script calls Pod.llm(prompt); the server brokers the call — the guest never sees a network, endpoint, or key",
        "Local-first: Ollama is the default, so pod data never leaves the box; remote is opt-in, env-only secrets, per-pod consent",
        "Closed by default — every call is Forbidden until the owner enables the pod; per-pod quotas + a tracing audit on every call",
        "Composes with the scheduler → reactive reasoning pods: summarize-on-write, classify-on-upload",
        "Scripts read your data and reason over it — and both the data and the compute stay user-owned",
      ],
    },
    {
      block: "content",
      kicker: "Part 03 · operating it",
      title: "Two operator surfaces",
      bullets: [
        "solidrs-cli — offline admin straight against storage: backups, DR, registry repair, scripted provisioning",
        "/.admin API — online cross-tenant control plane, closed by default (WebID allowlist + env bearer token)",
        "Multi-pod tenancy — one identity owning several pods, isolation enforced by the Authorizer",
        "Per-pod storage routing — pin a tenant to memory, fs, or a remote bucket; persisted in the registry",
      ],
    },
    {
      block: "quote",
      text: "No /.admin route returns or mutates pod contents — an operator stays WAC/ACP-denied on the data plane like anyone else. There is no master key.",
      attribution: "The privacy boundary, by design",
    },
    {
      block: "section",
      kicker: "Fin",
      title: "Own your data. Now in Rust.",
      note: "Single 32 MB binary · validated against mind/drive and the official harness · github.com/mind/solid-server-rs",
    },
  ],
};

export const exampleDecks: DeckSpec[] = [solidServerRsDeck, galleryDeck, launchDeck, reviewDeck];
