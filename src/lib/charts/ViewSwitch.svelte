<script lang="ts">
  // A "Charts | Tables" switch: links that set ?view= and keep everything else. Pages no longer carry it
  // (David, 17 Nov 2026: the charts read better); the chart components keep their table twins, and the
  // design preview shows them through this switch.
  import { ChartColumn, Table2 } from "@lucide/svelte";
  import type { View } from "./types.ts";
  import { withParams, type UrlLike } from "#lib/url.ts";
  let { url, view }: { url: UrlLike; view: View } = $props();
  const at = (v: View) => withParams(url, { view: v === "charts" ? null : v, offset: url.searchParams.get("offset") });
</script>

<nav class="fp-seg" aria-label="Charts or tables">
  <a href={at("charts")} aria-current={view === "charts" ? "page" : undefined}><ChartColumn class="fp-ico fp-ico--sm" strokeWidth={1.4} />Charts</a>
  <a href={at("tables")} aria-current={view === "tables" ? "page" : undefined}><Table2 class="fp-ico fp-ico--sm" strokeWidth={1.4} />Tables</a>
</nav>
