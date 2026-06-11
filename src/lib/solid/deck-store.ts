"use client";

import {
  overwriteFile,
  getSolidDataset,
  getContainedResourceUrlAll,
  deleteContainer,
  deleteFile,
} from "@inrupt/solid-client";
import { session } from "./session";
import { isBrokered, brokerFetch } from "./broker";
import { decksContainerFor, deckId } from "@/lib/config";
import { deckSchema, type DeckSpec } from "@/lib/spec/schema";
import { serializeDeck } from "@/lib/spec/serialize";

/**
 * Pod storage for decks. The BROWSER talks directly to the pod — no Mind
 * server ever sees the bytes (the privacy invariant shared across the fleet).
 * A deck lives at `<pod>/mind-slides/decks/<id>/`:
 *   - deck.json   — the DeckSpec, the source of truth
 *   - slides.md   — serialized convenience copy
 *   - meta.json   — { id, title, theme, slideCount, updatedAt }
 */

export interface DeckMeta {
  id: string;
  title: string;
  theme: string;
  slideCount: number;
  updatedAt: string;
}

function fetcher() {
  // Inside the Mind shell (brokered mode) this is the shell's scope-checked
  // broker fetch — Slides talks to the pod through the shell's authed fetch with
  // no credential of its own. Standalone it's the local OIDC session's fetch.
  return isBrokered() ? brokerFetch : session().fetch;
}

async function putText(url: string, body: string, type: string): Promise<void> {
  await overwriteFile(url, new Blob([body], { type }), {
    contentType: type,
    fetch: fetcher(),
  });
}

export async function saveDeck(
  podRoot: string,
  deck: DeckSpec,
  isoNow: string,
  existingId?: string
): Promise<DeckMeta> {
  const container = decksContainerFor(podRoot);
  const id = existingId ?? deckId(deck.title, isoNow.replace(/[^0-9]/g, "").slice(8, 14));
  const base = `${container}${id}/`;

  const meta: DeckMeta = {
    id,
    title: deck.title,
    theme: deck.theme,
    slideCount: deck.slides.length,
    updatedAt: isoNow,
  };

  // overwriteFile creates intermediate containers as needed.
  await putText(`${base}deck.json`, JSON.stringify(deck, null, 2), "application/json");
  await putText(`${base}slides.md`, serializeDeck(deck), "text/markdown");
  await putText(`${base}meta.json`, JSON.stringify(meta, null, 2), "application/json");

  return meta;
}

export async function listDecks(podRoot: string): Promise<DeckMeta[]> {
  const container = decksContainerFor(podRoot);
  let dataset;
  try {
    dataset = await getSolidDataset(container, { fetch: fetcher() });
  } catch {
    return []; // container doesn't exist yet → no decks
  }
  const childContainers = getContainedResourceUrlAll(dataset).filter((u) =>
    u.endsWith("/")
  );

  const metas = await Promise.all(
    childContainers.map(async (c) => {
      try {
        const res = await fetcher()(`${c}meta.json`);
        if (!res.ok) return null;
        return (await res.json()) as DeckMeta;
      } catch {
        return null;
      }
    })
  );
  return metas
    .filter((m): m is DeckMeta => m !== null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function loadDeck(
  podRoot: string,
  id: string
): Promise<DeckSpec | null> {
  const url = `${decksContainerFor(podRoot)}${id}/deck.json`;
  try {
    const res = await fetcher()(url);
    if (!res.ok) return null;
    const parsed = deckSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function removeDeck(podRoot: string, id: string): Promise<void> {
  const base = `${decksContainerFor(podRoot)}${id}/`;
  const f = fetcher();
  // LDP has no recursive delete: remove children, then the container.
  for (const name of ["deck.json", "slides.md", "meta.json"]) {
    try {
      await deleteFile(`${base}${name}`, { fetch: f });
    } catch {
      /* already gone */
    }
  }
  try {
    await deleteContainer(base, { fetch: f });
  } catch {
    /* already gone */
  }
}
