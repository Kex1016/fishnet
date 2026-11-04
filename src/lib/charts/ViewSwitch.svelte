<script lang="ts">
  // The page's one "Charts | Tables" switch: links that set ?view= and keep everything else.
  import { ChartColumn, Table2 } from "@lucide/svelte";
  import type { View } from "./types.ts";
  import { withParams, type UrlLike } from "#lib/url.ts";
  let { url, view }: { url: UrlLike; view: View } = $props();
  const at = (v: View) => withParams(url, { view: v === "charts" ? null : v, offset: url.searchParams.get("offset") });
</script>

<nav class="fp-seg" aria-label="Charts or tables">
  <a href={at("charts")} aria-current={view === "charts" ? "true" : undefined}><ChartColumn class="fp-ico fp-ico--sm" strokeWidth={1.4} />Charts</a>
  <a href={at("tables")} aria-current={view === "tables" ? "true" : undefined}><Table2 class="fp-ico fp-ico--sm" strokeWidth={1.4} />Tables</a>
</nav>
