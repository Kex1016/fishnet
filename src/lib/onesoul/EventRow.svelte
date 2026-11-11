<script lang="ts">
  // One timeline row: when, who, what. Names, death causes and waystone labels are player text (escaped by
  // Svelte, shown as quotes); unknown kinds read as their title-cased id. No positions are rendered here.
  import { Flame, Ghost, Skull, Tombstone, Hourglass, Circle } from "@lucide/svelte";
  import { ago, dateTime, iso } from "#lib/format/dates.ts";
  import { eventHasActor, eventLine } from "./format.ts";
  import type { OsEvent } from "./types.ts";
  let { e, now }: { e: OsEvent; now: number } = $props();
  const l = $derived(eventLine(e));
  const icons = { death: Skull, soul: Flame, grave: Tombstone, round: Hourglass, ghost: Ghost, other: Circle };
  const Icon = $derived(icons[l.tone]);
</script>

<li class="os-ev" data-tone={l.tone}>
  <Icon class="fp-ico fp-ico--sm os-ev__ico" strokeWidth={1.4} aria-hidden="true" />
  <div class="os-ev__body">
    <span>
      {#if eventHasActor(e)}<a class="os-ev__who" href="/players/{encodeURIComponent(e.name ?? '')}">{e.name}</a> {l.text}{:else}{l.text}{/if}
    </span>
    {#if l.quote}<q class="os-ev__quote">{l.quote}</q>{/if}
  </div>
  <time class="os-ev__at" datetime={iso(e.at)} title={dateTime(e.at)}>{e.kind === "prank" ? dateTime(e.at).split(",")[0] : ago(e.at, now)}</time>
</li>

<style>
  .os-ev {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto;
    gap: var(--space-3);
    align-items: start;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--line-soft);
  }
  .os-ev:last-child {
    border-bottom: 0;
  }
  :global(.os-ev__ico) {
    margin-top: 2px;
  }
  .os-ev[data-tone="death"] :global(.os-ev__ico) {
    color: var(--error-ink);
  }
  .os-ev[data-tone="soul"] :global(.os-ev__ico) {
    color: var(--soul-ink, var(--acc-ink));
  }
  .os-ev[data-tone="grave"] :global(.os-ev__ico) {
    color: var(--acc-ink);
  }
  .os-ev__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    font: 400 14px/20px var(--font-text);
    overflow-wrap: anywhere;
  }
  .os-ev__who {
    font-weight: 600;
    color: var(--text);
  }
  .os-ev__quote {
    color: var(--muted);
    font-style: italic;
  }
  .os-ev__at {
    font: 400 12px/20px var(--font-mono);
    color: var(--faint);
    white-space: nowrap;
  }
</style>
