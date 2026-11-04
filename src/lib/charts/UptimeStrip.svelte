<script lang="ts">
  // A server's time as a strip of buckets: linked buckets filled by how many were online (the heat
  // ramp), unlinked ones in the error wash, buckets without samples a hairline. The readout starts on
  // the linked share and follows hover and the arrow keys.
  import type { UptimeStripProps } from "./types.ts";
  import ChartCard from "./ChartCard.svelte";
  import DataTable from "./DataTable.svelte";
  import { dateTime, hm, day } from "#lib/format/dates.ts";
  import { heatLevel, linkedShare, uptimeBuckets } from "./scale.ts";
  import "./charts.css";

  let { samples, bucketMs, ...frame }: UptimeStripProps = $props();
  const empty = $derived(samples.length < 2);
  const rows = $derived(samples.map((s) => ({ when: dateTime(s.t), online: s.online, waiting: s.waiting, linked: s.linked ? "yes" : "no" })));
  const buckets = $derived(uptimeBuckets(samples, bucketMs));
  const share = $derived(linkedShare(buckets));
  const max = $derived(Math.max(0, ...buckets.map((b) => b.online)));
  const span = $derived(buckets.length ? buckets[buckets.length - 1].t1 - buckets[0].t0 : 0);
  const whenOf = (t: number) => (span <= 2 * 86_400_000 ? `${hm(t)} UTC` : `${day(t)}, ${hm(t)} UTC`);

  const H = 40;
  const GAP = 1;
  let width = $state(560);
  const n = $derived(buckets.length);
  const slot = $derived(n ? width / n : 0);

  let hover = $state<number | null>(null);
  const b = $derived(hover !== null ? buckets[hover] : undefined);
  const readoutValue = $derived(b ? (b.linked === "unknown" ? "no data" : b.linked === "none" ? "not linked" : `${Math.round(b.online)} online`) : share === null ? undefined : `${Math.round(share * 100)}% linked`);
  const readoutLabel = $derived(b ? `${whenOf(b.t0)} – ${whenOf(b.t1)}${b.linked === "all" && b.waiting > 0 ? ` · ${Math.round(b.waiting)} waiting` : b.linked === "some" ? " · partly linked" : ""}` : buckets.length ? `${day(buckets[0].t0)} – ${day(buckets[n - 1].t1)}` : undefined);

  let svg = $state<SVGSVGElement>();
  function pointAt(e: PointerEvent) {
    if (!svg || !n) return;
    const r = svg.getBoundingClientRect();
    hover = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)));
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
  <div class="fp-plot__wrap" bind:clientWidth={width}>
      <!-- the chart is a figure whose readout follows the pointer and the arrow keys; the table twin is the accessible form -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg bind:this={svg} class="fp-plot" viewBox="0 0 {width} {H}" height={H} role="img" aria-label={summary} tabindex="0" onpointermove={pointAt} onpointerdown={pointAt} onpointerleave={() => (hover = null)} onblur={() => (hover = null)} onkeydown={key}>
      {#each buckets as bk, i (bk.t0)}
        {@const cls = bk.linked === "all" ? `fp-plot__cell--${Math.max(1, heatLevel(bk.online, max))}` : `fp-plot__strip--${bk.linked}`}
        <rect class="fp-plot__cell {cls}" class:fp-plot__strip--active={hover === i} x={slot * i + 0.5} y="0.5" width={Math.max(0.5, slot - GAP - 1)} height={H - 1} rx={Math.min(2, slot / 2)} />
      {/each}
    </svg>
    <div class="fp-plot__legend">
      <span><i class="fp-plot__key fp-strip__key--on"></i>linked, online by shade</span>
      <span><i class="fp-plot__key fp-strip__key--off"></i>not linked</span>
      <span><i class="fp-plot__key fp-strip__key--unknown"></i>no sample</span>
    </div>
  </div>
  {#snippet table()}<DataTable columns={[{ key: "when", label: "When" }, { key: "online", label: "Online", num: true }, { key: "waiting", label: "Waiting", num: true }, { key: "linked", label: "Linked" }]} {rows} caption={frame.title} />{/snippet}
</ChartCard>

<style>
  .fp-strip__key--on { background: var(--acc-heat-3); }
  .fp-strip__key--off { background: var(--error-soft); border: 1px solid var(--error); }
  .fp-strip__key--unknown { border: 1px solid var(--line); }
</style>
