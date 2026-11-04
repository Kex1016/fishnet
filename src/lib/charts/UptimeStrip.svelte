<script lang="ts">
  // W0 stub (W3 draws the strip: linked/unlinked buckets with online as the fill).
  import type { UptimeStripProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { dateTime } from "#lib/format/dates.ts";
  let { samples, bucketMs, ...frame }: UptimeStripProps = $props();
  const empty = $derived(samples.length < 2);
  const rows = $derived(samples.map((s) => ({ when: dateTime(s.t), online: s.online, waiting: s.waiting, linked: s.linked ? "yes" : "no" })));
</script>

<ChartCard {frame} {empty}>
  <div class="fp-chart__stub" style="height: 40px" role="img" aria-label="{frame.title}: {samples.length} samples">
    <span class="t-caption">Uptime strip: W3</span>
  </div>
  {#snippet table()}<DataTable columns={[{ key: "when", label: "When" }, { key: "online", label: "Online", num: true }, { key: "waiting", label: "Waiting", num: true }, { key: "linked", label: "Linked" }]} {rows} caption={frame.title} />{/snippet}
</ChartCard>

<style>
  .fp-chart__stub { display: grid; place-items: center; background: var(--sunk); border-radius: var(--radius-lg); }
</style>
