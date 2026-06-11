---
theme: "default"
title: "solid-server-rs"
colorSchema: "dark"
transition: "slide-left"
mdc: true
layout: "title"
class: "palette-mind"
data: {"kicker":"Mind · Solid infrastructure","title":"solid-server-rs","subtitle":"A scalable, secure Solid Personal Data Server — rewritten in Rust."}
---

---
title: "What we'll cover"
layout: "agenda"
class: "palette-mind"
data: {"title":"What we'll cover","items":["What it is, and why rebuild the server","How it compares to the Community Solid Server","The performance story","What works today (v1 MVP)","Built to extend: plugins, WASM, brokered LLM","Operator surfaces & the privacy boundary"]}
---

---
title: "A pod server where DID auth and a plugin system are first-class."
layout: "hero"
class: "palette-mind"
data: {"kicker":"The idea","headline":"A pod server where DID auth and a plugin system are first-class.","sub":"A greenfield re-architecture of the Community Solid Server — Axum + Sophia + rustls, a single binary, passwordless did:key login native, and an extension model that's ours.","cta":"Point any Solid app at http://localhost:3061/ and it just works."}
---

---
title: "C00"
layout: "section"
class: "palette-mind"
data: {"kicker":"Part 01","title":"C00","note":"CSS gave us the blueprint. Rust lets us own the auth, the safety, and the speed."}
---

---
title: "Reference vs. the Rust rebuild"
layout: "comparison"
class: "palette-mind"
data: {"title":"Reference vs. the Rust rebuild","left":{"heading":"Community Solid Server (Node.js)","points":["Single-threaded event loop","597 req/s on the fair endpoint","366 MB resident memory","p99 latency 188 ms","Password / OIDC auth"]},"right":{"heading":"solid-server-rs (Rust)","points":["Multi-threaded tokio runtime","91,980 req/s — about 154×","18 MB resident — about 18× leaner","p99 latency 1 ms","DID passwordless auth, native"]}}
---

---
title: "154× · the throughput of CSS"
layout: "bigNumber"
class: "palette-mind"
data: {"value":"154×","label":"the throughput of CSS","caption":"Identical OIDC discovery endpoint · 91,980 vs 597 req/s · Apple M3 Pro, release build"}
---

---
title: "What works today"
layout: "content"
class: "palette-mind"
data: {"kicker":"v1 MVP — working","title":"What works today","bullets":["LDP CRUD with containment triples + RDF content negotiation (Turtle, N-Triples, JSON-LD)","SPARQL 1.1 query (Oxigraph) and full N3 Patch + SPARQL-Update PATCH","Web Access Control by default, plus Access Control Policy (--authz acp)","DID auth (did:key / Ed25519): challenge → sign → verify, pod auto-provision","Solid-OIDC provider — DPoP-bound tokens, PKCE, client_credentials","WebSocket + WebHook notifications (Activity Streams 2.0)"]}
---

- LDP CRUD with containment triples + RDF content negotiation (Turtle, N-Triples, JSON-LD)
- SPARQL 1.1 query (Oxigraph) and full N3 Patch + SPARQL-Update PATCH
- Web Access Control by default, plus Access Control Policy (--authz acp)
- DID auth (did:key / Ed25519): challenge → sign → verify, pod auto-provision
- Solid-OIDC provider — DPoP-bound tokens, PKCE, client_credentials
- WebSocket + WebHook notifications (Activity Streams 2.0)

---
title: "What landed on the way to v1"
layout: "timeline"
class: "palette-mind"
data: {"title":"What landed on the way to v1","items":[{"date":"Core","label":"LDP CRUD · WAC · DID auth · Solid-OIDC"},{"date":"RDF","label":"SPARQL query · full N3 Patch · ACP"},{"date":"Scale","label":"Multi-pod tenancy · per-pod storage routing"},{"date":"Extend","label":"WASM plugins · programmable pods · brokered LLM"},{"date":"Proof","label":"Official conformance harness · S3/GCS/Azure"}]}
---

---
title: "596 / 647 · official MUST conformance scenarios"
layout: "bigNumber"
class: "palette-mind"
data: {"value":"596 / 647","label":"official MUST conformance scenarios","caption":"Solid Conformance Test Harness — the CSS/ESS/NSS certifier — running end-to-end"}
---

---
title: "Built to extend"
layout: "section"
class: "palette-mind"
data: {"kicker":"Part 02","title":"Built to extend","note":"A 15-crate workspace behind swappable traits — Repo, Authorizer, Notifier, LlmBroker."}
---

---
title: "Beyond a data server"
layout: "content"
class: "palette-mind"
data: {"kicker":"The plugin model","title":"Beyond a data server","bullets":["WASM plugins — run untrusted guest code in-process, sandboxed (zero ambient caps) and fuel-metered","Programmable pods — upload a script, run it over HTTP within your own rights, write back in place","No-build JS authoring — upload plain JavaScript, interpreted by a bundled pure-Rust Boa engine","Remote object stores — S3 / GCS / Azure via OpenDAL, selectable per pod with RepoRouter"]}
---

- WASM plugins — run untrusted guest code in-process, sandboxed (zero ambient caps) and fuel-metered
- Programmable pods — upload a script, run it over HTTP within your own rights, write back in place
- No-build JS authoring — upload plain JavaScript, interpreted by a bundled pure-Rust Boa engine
- Remote object stores — S3 / GCS / Azure via OpenDAL, selectable per pod with RepoRouter

---
title: "Agentic pods"
layout: "content"
class: "palette-mind"
data: {"kicker":"host.llm — brokered, not networked","title":"Agentic pods","bullets":["A sandboxed script calls Pod.llm(prompt); the server brokers the call — the guest never sees a network, endpoint, or key","Local-first: Ollama is the default, so pod data never leaves the box; remote is opt-in, env-only secrets, per-pod consent","Closed by default — every call is Forbidden until the owner enables the pod; per-pod quotas + a tracing audit on every call","Composes with the scheduler → reactive reasoning pods: summarize-on-write, classify-on-upload","Scripts read your data and reason over it — and both the data and the compute stay user-owned"]}
---

- A sandboxed script calls Pod.llm(prompt); the server brokers the call — the guest never sees a network, endpoint, or key
- Local-first: Ollama is the default, so pod data never leaves the box; remote is opt-in, env-only secrets, per-pod consent
- Closed by default — every call is Forbidden until the owner enables the pod; per-pod quotas + a tracing audit on every call
- Composes with the scheduler → reactive reasoning pods: summarize-on-write, classify-on-upload
- Scripts read your data and reason over it — and both the data and the compute stay user-owned

---
title: "Two operator surfaces"
layout: "content"
class: "palette-mind"
data: {"kicker":"Part 03 · operating it","title":"Two operator surfaces","bullets":["solidrs-cli — offline admin straight against storage: backups, DR, registry repair, scripted provisioning","/.admin API — online cross-tenant control plane, closed by default (WebID allowlist + env bearer token)","Multi-pod tenancy — one identity owning several pods, isolation enforced by the Authorizer","Per-pod storage routing — pin a tenant to memory, fs, or a remote bucket; persisted in the registry"]}
---

- solidrs-cli — offline admin straight against storage: backups, DR, registry repair, scripted provisioning
- /.admin API — online cross-tenant control plane, closed by default (WebID allowlist + env bearer token)
- Multi-pod tenancy — one identity owning several pods, isolation enforced by the Authorizer
- Per-pod storage routing — pin a tenant to memory, fs, or a remote bucket; persisted in the registry

---
title: "The privacy boundary, by design"
layout: "quote"
class: "palette-mind"
data: {"text":"No /.admin route returns or mutates pod contents — an operator stays WAC/ACP-denied on the data plane like anyone else. There is no master key.","attribution":"The privacy boundary, by design"}
---

---
title: "Own your data. Now in Rust."
layout: "section"
class: "palette-mind"
data: {"kicker":"Fin","title":"Own your data. Now in Rust.","note":"Single 32 MB binary · validated against mind/drive and the official harness · github.com/mind/solid-server-rs"}
---
