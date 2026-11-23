<script lang="ts">
  // A server's time as a strip of buckets: linked buckets take the heat steps by how many were online; buckets
  // linked for only part of the time are dithered, unlinked ones solid love, buckets without samples a dashed
  // outline. The readout starts on the linked share and follows hover and the arrow keys.
  import type { UptimeStripProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { dateTime, utcDay as day, utcHm as hm } from "#lib/format/dates.ts";
  import { heatLevel, linkedShare, uptimeBuckets } from "./scale.ts";
  import { nearestChild } from "./dom.ts";

  let { samples, bucketMs, ...frame }: UptimeStripProps = $props();
  const empty = $derived(samples.length < 2);
  const rows = $derived(samples.map((s) => ({ when: dateTime(s.t), online: s.online, waiting: s.waiting, linked: s.linked ? "yes" : "no" })));
  const buckets = $derived(uptimeBuckets(samples, bucketMs));
  const share = $derived(linkedShare(buckets));
  const max = $derived(Math.max(0, ...buckets.map((b) => b.online)));
  const span = $derived(buckets.length ? buckets[buckets.length - 1].t1 - buckets[0].t0 : 0);
  const whenOf = (t: number) => (span <= 2 * 86_400_000 ? `${hm(t)} UTC` : `${day(t)}, ${hm(t)} UTC`);
  const n = $derived(buckets.length);
  const classOf = (b: (typeof buckets)[number]) => (b.linked === "all" ? `h${Math.max(1, heatLevel(b.online, max))}` : b.linked === "some" ? "part" : b.linked === "none" ? "off" : "none");

  let width = $state(560);
  const gap = $derived(n && width / n >= 3 ? 1 : 0);

  let hover = $state<number | null>(null);
  const b = $derived(hover !== null ? buckets[hover] : undefined);
  const readoutValue = $derived(b ? (b.linked === "unknown" ? "no data" : b.linked === "none" ? "not linked" : `${Math.round(b.online)} online`) : share === null ? undefined : `${Math.round(share * 100)}% linked`);
  const readoutLabel = $derived(b ? `${whenOf(b.t0)} – ${whenOf(b.t1)}${b.linked === "all" && b.waiting > 0 ? ` · ${Math.round(b.waiting)} waiting` : b.linked === "some" ? " · partly linked" : ""}` : buckets.length ? `${day(buckets[0].t0)} – ${day(buckets[n - 1].t1)}` : undefined);

  let strip = $state<HTMLElement>();
  function pointAt(e: PointerEvent) {
    const i = nearestChild(strip, e.clientX);
    if (i >= 0) hover = i;
  }
  function key(e: KeyboardEvent) {
    const cur = hover ?? n - 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      hover = Math.max(0, Math.min(n - 1, cur + (e.key === "ArrowLeft" ? -1 : 1)));
    } else if (e.key === "Home") hover = 0;
    else if (e.key === "End") hover = n - 1;
    else if (e.key === "Escape") hover = null;
  }
  const summary = $derived(share === null ? frame.title : `${frame.title}: linked ${Math.round(share * 100)}% of the time over ${n} buckets, up to ${Math.round(max)} online`);
</script>

<ChartCard {frame} {empty} {readoutValue} {readoutLabel}>
  <!-- the chart is a figure whose readout follows the pointer and the arrow keys; the table twin is the accessible form -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div class="fx-plot" bind:clientWidth={width} role="img" aria-label={summary} tabindex="0" onpointermove={pointAt} onpointerdown={pointAt} onpointerleave={() => (hover = null)} onblur={() => (hover = null)} onkeydown={key}>
    <div class="fx-up" bind:this={strip} style="gap: {gap}px">
      {#each buckets as bk, i (bk.t0)}<i class={classOf(bk)} class:on={hover === i}></i>{/each}
    </div>
    <div class="fx-legend">
      <i class="h3"></i><span>linked, online by shade</span>
      <i class="part gap"></i><span>partly linked</span>
      <i class="off gap"></i><span>not linked</span>
      <i class="none gap"></i><span>no sample</span>
    </div>
  </div>
  {#snippet table()}<DataTable columns={[{ key: "when", label: "When" }, { key: "online", label: "Online", num: true }, { key: "waiting", label: "Waiting", num: true }, { key: "linked", label: "Linked" }]} {rows} caption={frame.title} />{/snippet}
</ChartCard>
