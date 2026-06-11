import Link from "next/link";
import { Button } from "@mind-studio/ui";

export default function Landing() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16 sm:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Agentic slide generation
      </p>
      <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
        Describe a deck. Watch it render.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        Mind Slides turns a brief into a polished presentation by filling a{" "}
        <em>controlled set</em> of slide blocks — hero, big-number, comparison,
        quote, timeline, cinematic section breaks. The agent never writes CSS or
        layout; it only chooses and fills blocks, which a serializer renders with{" "}
        <a
          className="text-primary underline-offset-4 hover:underline"
          href="https://sli.dev"
        >
          Slidev
        </a>
        . The result is reliably beautiful — and yours: decks live in your pod.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/studio">Open the studio</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/connect">Connect a pod</Link>
        </Button>
      </div>

      <section className="mt-20 grid gap-8 sm:grid-cols-3">
        <Feature
          title="A controlled block set"
          body="Ten fixed, token-driven layouts. The agent fills them with structured content — it can't inject arbitrary CSS or JS."
        />
        <Feature
          title="Spec → Slidev"
          body="Generation emits a schema-validated DeckSpec; one serializer turns it into Slidev Markdown. The spec is the only contract."
        />
        <Feature
          title="Multi-theme, pod-backed"
          body="Switch the palette and every block reskins from tokens. Save a deck and it's written to your Solid pod, not our servers."
        />
      </section>

      <p className="mt-16 rounded-lg border bg-muted/40 px-5 py-4 font-mono text-xs leading-relaxed text-muted-foreground">
        Privacy invariant: your browser talks directly to your pod. The brief
        you type is sent to the generation model (this is the authoring tool),
        but your saved decks never touch a Mind server.
      </p>
    </section>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-lg font-semibold tracking-tight">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
