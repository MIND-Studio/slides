"use client";

import {
  deleteContainer,
  deleteFile,
  getContainedResourceUrlAll,
  getSolidDataset,
  overwriteFile,
} from "@inrupt/solid-client";
import { deckId, decksContainerFor } from "@/lib/config";
import { type DeckSpec, deckSchema } from "@/lib/spec/schema";
import { serializeDeck } from "@/lib/spec/serialize";
import { fetcher } from "./fetcher";

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
  existingId?: string,
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
  const childContainers = getContainedResourceUrlAll(dataset).filter((u) => u.endsWith("/"));

  const metas = await Promise.all(
    childContainers.map(async (c) => {
      try {
        const res = await fetcher()(`${c}meta.json`);
        if (!res.ok) return null;
        return (await res.json()) as DeckMeta;
      } catch {
        return null;
      }
    }),
  );
  return metas
    .filter((m): m is DeckMeta => m !== null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function loadDeck(podRoot: string, id: string): Promise<DeckSpec | null> {
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
  // LDP has no recursive delete: enumerate the container's children and remove
  // each, then the container. Enumerating (rather than a hardcoded name list)
  // also catches deck.pdf and anything added later — a leftover child makes the
  // deleteContainer fail with 409 and orphans the deck folder. Recurses on
  // sub-containers (deck folders are flat today, but stay robust if that changes).
  const base = `${decksContainerFor(podRoot)}${id}/`;
  const f = fetcher();

  async function purge(container: string): Promise<void> {
    let children: string[] = [];
    try {
      children = getContainedResourceUrlAll(await getSolidDataset(container, { fetch: f }));
    } catch {
      return; // doesn't exist
    }
    for (const child of children) {
      if (child.endsWith("/")) await purge(child);
      else await deleteFile(child, { fetch: f }).catch(() => {});
    }
    await deleteContainer(container, { fetch: f }).catch(() => {});
  }

  await purge(base);
}

/** Store the exported PDF alongside the deck at `decks/<id>/deck.pdf`. */
export async function savePdf(podRoot: string, id: string, pdf: Blob): Promise<string> {
  const url = `${decksContainerFor(podRoot)}${id}/deck.pdf`;
  await overwriteFile(url, pdf, { contentType: "application/pdf", fetch: fetcher() });
  return url;
}
