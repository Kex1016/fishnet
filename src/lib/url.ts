// Links that change one search param and keep the rest. `page.url` is read-only in Svelte, so the
// components take this shape instead of URL.
export type UrlLike = { pathname: string; search: string; searchParams: { get(name: string): string | null } };

/** pathname + search with `changes` applied (null deletes). Drops `offset` unless it is set here. */
export function withParams(url: UrlLike, changes: Record<string, string | null>): string {
  const p = new URLSearchParams(url.search);
  if (!("offset" in changes)) p.delete("offset");
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === "") p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `${url.pathname}?${s}` : url.pathname;
}
