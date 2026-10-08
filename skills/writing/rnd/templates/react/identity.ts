"use client";

// Per-person identity for an rnd consensus page → lib/rnd/identity.ts.
// The chosen participant is written to the URL (?as=jana) so the shared link
// returns you as the same person; localStorage is the fallback. Read via
// useSyncExternalStore so SSR stays null (no hydration mismatch) and the gate
// resolves on the client. Port of founder-x platform-redesign/_components/identity.ts.

const EVENT = "rnd-identity-change";

function lsKey(slug: string): string {
  return `rnd-${slug}-identity`;
}

function normalize(valid: string[], raw: string | null): string | null {
  if (!raw) return null;
  return valid.find((p) => p.toLowerCase() === raw.toLowerCase()) ?? null;
}

let cache: Record<string, string | null | undefined> = {};

function read(slug: string, valid: string[]): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = normalize(valid, new URLSearchParams(window.location.search).get("as"));
  if (fromUrl) return fromUrl;
  return normalize(valid, window.localStorage.getItem(lsKey(slug)));
}

export function getIdentitySnapshot(slug: string, valid: string[]): string | null {
  if (cache[slug] === undefined) cache[slug] = read(slug, valid);
  return cache[slug] ?? null;
}

export function setIdentity(slug: string, id: string): void {
  if (typeof window === "undefined") return;
  cache[slug] = id;
  window.localStorage.setItem(lsKey(slug), id);
  const url = new URL(window.location.href);
  url.searchParams.set("as", id.toLowerCase());
  window.history.replaceState(null, "", url.toString());
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function clearIdentity(slug: string): void {
  if (typeof window === "undefined") return;
  cache[slug] = null;
  window.localStorage.removeItem(lsKey(slug));
  const url = new URL(window.location.href);
  url.searchParams.delete("as");
  window.history.replaceState(null, "", url.toString());
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeIdentity(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    cache = {};
    onChange();
  };
  window.addEventListener(EVENT, handler);
  window.addEventListener("popstate", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("popstate", handler);
    window.removeEventListener("storage", handler);
  };
}
