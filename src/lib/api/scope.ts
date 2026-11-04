// Scopes (API §2): network (default), server:<id>, mini:<server>/<mini>. Never add scopes together
// (cakeutils I3, G-16): a network figure already contains its servers, a server its minis.

export type Scope = "network" | `server:${string}` | `mini:${string}/${string}`;

export type ParsedScope =
  | { kind: "network" }
  | { kind: "server"; server: string }
  | { kind: "mini"; server: string; mini: string };

const ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Parses a scope string from a URL; null when it is not well-formed. */
export function parseScope(s: string | null | undefined): ParsedScope | null {
  if (!s || s === "network") return { kind: "network" };
  if (s.startsWith("server:")) {
    const server = s.slice(7);
    return ID.test(server) ? { kind: "server", server } : null;
  }
  if (s.startsWith("mini:")) {
    const rest = s.slice(5);
    const slash = rest.indexOf("/");
    if (slash < 1) return null;
    const server = rest.slice(0, slash);
    const mini = rest.slice(slash + 1);
    return ID.test(server) && mini.length >= 1 && mini.length <= 64 && !mini.includes("/") ? { kind: "mini", server, mini } : null;
  }
  return null;
}

export function scopeOf(p: ParsedScope): Scope {
  if (p.kind === "network") return "network";
  if (p.kind === "server") return `server:${p.server}`;
  return `mini:${p.server}/${p.mini}`;
}

/** A scope from a URL search param, or "network" when absent or malformed (pages 400 on their own if they want). */
export function scopeParam(url: URL): Scope {
  const p = parseScope(url.searchParams.get("scope"));
  return p ? scopeOf(p) : "network";
}
