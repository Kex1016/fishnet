// What may appear in a log line (CLAUDE.md "Rules that never bend"): a token's public id and a URL's
// scheme://host:port. Pure functions, no env access, so tests and scripts can import them.

/** `cu_<id>` of a token, the only form that may appear in logs. */
export function tokenId(token: string): string {
  const m = /^(cu_[A-Za-z0-9]+)_/.exec(token);
  return m ? m[1] : token ? "cu_?" : "(none)";
}

/** `scheme://host:port` of a URL, for logs (never a path or query). */
export function displayUrl(u: string): string {
  try {
    const x = new URL(u);
    return `${x.protocol}//${x.host}`;
  } catch {
    return "(bad url)";
  }
}

/** An error text with every URL cut to scheme://host:port and every token cut to its public id. */
export function scrub(text: string): string {
  return text
    .replace(/\bcu_[A-Za-z0-9]+_[A-Za-z0-9._~+/=-]+/g, (t) => tokenId(t))
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)]+/gi, (u) => displayUrl(u))
    .slice(0, 300);
}
