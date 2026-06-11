/**
 * Pod URL helpers. Mind Slides claims one namespace in the pod —
 * `<pod>/mind-slides/decks/` — and never touches anything outside it.
 */
export const POD_BASE_URL =
  process.env.NEXT_PUBLIC_POD_BASE_URL ?? "http://localhost:3102/";

export const DECKS_PATH = "mind-slides/decks/";

/** `http://host/alice/profile/card#me` → `http://host/alice/`. */
export function podRootFromWebId(webId: string): string {
  const url = new URL(webId);
  url.hash = "";
  url.search = "";
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[parts.length - 1].startsWith("card")) {
    parts.pop();
    parts.pop();
  }
  url.pathname = "/" + parts.join("/") + (parts.length ? "/" : "");
  return url.toString();
}

export function decksContainerFor(podRoot: string): string {
  return (podRoot.endsWith("/") ? podRoot : podRoot + "/") + DECKS_PATH;
}

/** A url-safe id from a title plus a short disambiguator. */
export function deckId(title: string, salt: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "deck";
  return `${slug}-${salt}`;
}
