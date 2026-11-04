import type { View } from "./types.ts";
import type { UrlLike } from "#lib/url.ts";

/** ?view=tables or charts (default). */
export function viewParam(url: UrlLike): View {
  return url.searchParams.get("view") === "tables" ? "tables" : "charts";
}
