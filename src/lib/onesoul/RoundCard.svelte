<script lang="ts">
  // One round as a card: its dates, souls, time survived, longest life, graves. Counts are inside the round only.
  import type { RoundSummary } from "#lib/server/onesoul/section.ts";
  import { day } from "#lib/format/dates.ts";
  import { life, stateLabel } from "./format.ts";
  import { osHref } from "./links.ts";
  let { r, current }: { r: RoundSummary; current: boolean } = $props();
</script>

<a class="fp-card os-round" href={osHref.round(r.cycle)}>
  <div class="os-round__head">
    <h2 class="t-title-2">Round {r.cycle}</h2>
    <span class="fp-tag {current ? 'fp-tag--acc' : ''}">{current ? (r.state ? stateLabel(r.state) : "Now") : "Over"}</span>
  </div>
  <div class="t-small t-muted">
    {#if r.started_at}{day(r.started_at)}{#if r.ended_at} to {day(r.ended_at)}{/if}{:else}World not opened yet{/if}
  </div>
  <dl class="os-round__facts">
    <div><dt>Souls</dt><dd class="t-num">{r.souls}</dd></div>
    <div><dt>Time survived</dt><dd class="t-num">{life(r.total_survival_ms)}</dd></div>
    {#if r.longest}<div><dt>Longest life</dt><dd><span class="t-num">{life(r.longest.duration_ms)}</span> <span class="t-small t-muted">{r.longest.name}</span></dd></div>{/if}
    {#if r.graves}<div><dt>Graves claimed</dt><dd class="t-num">{r.graves.total ? `${r.graves.claimed} of ${r.graves.total}` : "none"}</dd></div>{/if}
    {#if r.registered !== null}<div><dt>Signed up</dt><dd class="t-num">{r.registered}</dd></div>{/if}
  </dl>
</a>

<style>
  .os-round {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    color: inherit;
    text-decoration: none;
  }
  .os-round:hover {
    text-decoration: none;
    border-color: var(--acc);
  }
  .os-round__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }
  .os-round__facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space-3);
    margin: var(--space-2) 0 0;
  }
  .os-round__facts dt {
    font: 600 11px/16px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .os-round__facts dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
