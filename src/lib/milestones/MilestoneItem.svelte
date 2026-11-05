<script lang="ts">
  // Internal: one feed row. The stat (icon, threshold, name), the player, and when. Every null has words.
  import type { Kind, MilestoneFeedRow } from "#lib/api/types.ts";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { dateTime, ago, iso } from "#lib/format/dates.ts";
  import { rowPhrase, statHref, statLabel, whenOf, whoOf } from "./helpers.ts";
  let { m, showStat = true, showPlayer = true, scope }: { m: MilestoneFeedRow; showStat?: boolean; showPlayer?: boolean; scope?: string } = $props();
  const who = $derived(whoOf(m));
  const when = $derived(whenOf(m));
  const name = $derived(statLabel(m));
  const phrase = $derived(rowPhrase(m));
  const href = $derived(statHref(m, scope));
</script>

<li class="fp-ms">
  {#if showStat}<Slot icon={m.icon} kind={(m.kind as Kind | null | undefined) ?? (m.subject === "*" ? "custom" : null)} {name} />{/if}
  <div class="fp-ms__main">
    <div class="fp-ms__what">
      {#if showStat && href}<a class="fp-ms__stat" {href}>{phrase.before}<span class="fp-ms__thr">{phrase.value}</span>{phrase.after}</a>
      {:else}<span class="fp-ms__stat">{phrase.before}<span class="fp-ms__thr">{phrase.value}</span>{phrase.after}</span>{/if}
    </div>
    {#if showPlayer}
      <div class="fp-ms__who">
        {#if who}<PlayerName uuid={who.uuid} name={who.name} />
        {:else}<span class="t-muted">First player unknown</span>{/if}
      </div>
    {/if}
  </div>
  <div class="fp-ms__when">
    {#if when.state === "at"}<time datetime={iso(when.at)} title={dateTime(when.at)}>{ago(when.at)}</time>
    {:else if when.state === "before"}<span class="fp-tag">Reached before tracking began</span>
    {:else}<span class="t-faint">Not reached yet</span>{/if}
  </div>
</li>

<style>
  .fp-ms { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); min-height: 52px; padding: var(--space-2) var(--space-3); border-radius: var(--radius-lg); }
  .fp-ms:not(:has(:global(.fp-slot))) { grid-template-columns: minmax(0, 1fr) auto; }
  .fp-ms:hover { background: var(--raised); }
  .fp-ms__main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .fp-ms__what { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2); min-width: 0; }
  .fp-ms__thr { font: 600 15px/20px var(--font-mono); font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--text); }
  .fp-ms__stat { font: 500 15px/20px var(--font-text); color: var(--text); overflow-wrap: anywhere; }
  a.fp-ms__stat:hover { color: var(--acc-ink); text-decoration: none; }
  .fp-ms__who { font: 400 13px/20px var(--font-text); min-width: 0; }
  .fp-ms__when { font: 400 12px/16px var(--font-mono); color: var(--faint); text-align: right; max-width: 150px; }
  .fp-ms__when :global(.fp-tag) { height: auto; min-height: 20px; padding-top: 2px; padding-bottom: 2px; white-space: normal; text-align: left; line-height: 14px; }
  @media (max-width: 640px) { .fp-ms__when { max-width: 110px; } }
</style>
