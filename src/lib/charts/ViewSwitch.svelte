<script lang="ts">
  // A "Charts | Tables" switch: links that set ?view= and keep everything else. Pages no longer carry it
  // (David, 17 Nov 2026: the charts read better); the chart components keep their table twins, and the
  // design preview shows them through this switch.
  import type { View } from "./types.ts";
  import Segmented from "#lib/design/Segmented.svelte";
  import { withParams, type UrlLike } from "#lib/url.ts";
  let { url, view }: { url: UrlLike; view: View } = $props();
  const at = (v: View) => withParams(url, { view: v === "charts" ? null : v, offset: url.searchParams.get("offset") });
</script>

<Segmented label="Charts or tables" options={[{ href: at("charts"), label: "charts", current: view === "charts" }, { href: at("tables"), label: "tables", current: view === "tables" }]} />
