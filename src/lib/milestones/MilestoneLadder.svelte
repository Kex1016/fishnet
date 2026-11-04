<script lang="ts">
  // One stat's ladder, lowest rung first (at most 18): who was first to each, when, and the next one to
  // reach. Thresholds are data: `display` as the API gives it, no table of 1/100/1000 here.
  import type { MilestoneLadderProps } from "./types.ts";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { problemCode } from "#lib/api/result.ts";
  import { ago, dateTime, iso } from "#lib/format/dates.ts";
  import { nextRung, whenOf, whoOf } from "./helpers.ts";
  let { result, statName, icon, kind }: MilestoneLadderProps = $props();
  const next = $derived(result.ok ? nextRung(result.data.milestones) : -1);
</script>

{#if !result.ok}
  {#if result.kind === "off"}
    <!-- the proxy has no milestones: the section is not rendered at all -->
  {:else if result.kind === "not_found"}
    <EmptyState title="Nobody has done this yet" line={statName ? `${statName} gets a ladder once someone records it.` : undefined} />
  {:else if result.kind === "down"}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> The ladder will be back when it is. {#if result.asOf}<AsOf at={result.asOf} stale />{/if}</Notice>
  {:else if result.kind === "bad_request" && problemCode(result) === "mixed_units"}
    <EmptyState title="No milestones for this stat" line="This total mixes units, so it has no ladder." />
  {:else}
    <EmptyState title="No milestones for this view" line="Try the network or a server." />
  {/if}
{:else if !result.data.tracked}
  <EmptyState title="No milestones for this stat" line="Time and damage stats do not have a ladder." />
{:else}
  {#if result.stale}<Notice kind="warning"><b>cakeutils could not be reached.</b> Showing the last good data, <AsOf at={result.asOf} stale />.</Notice>{/if}
  {#if statName || icon}
    <div class="fp-lad__head">
      <Slot {icon} kind={kind as never} name={statName} />
      <span class="t-title-4">{statName}</span>
    </div>
  {/if}
  {#if result.data.milestones.length === 0}
    <EmptyState title="No milestones yet" line="The first player to reach a threshold shows up here." />
  {:else}
    <ol class="fp-lad">
      {#each result.data.milestones as m, i (m.threshold)}
        {@const who = whoOf(m)}
        {@const when = whenOf(m)}
        <li class="fp-lad__rung" class:fp-lad__rung--todo={when.state === "none"} class:fp-lad__rung--next={i === next} aria-current={i === next ? "step" : undefined}>
          <span class="fp-lad__thr">{m.display}</span>
          <span class="fp-lad__who">
            {#if who}<PlayerName uuid={who.uuid} name={who.name} />
            {:else if when.state === "none"}<span class="t-faint">{i === next ? "Next to reach" : "Not reached yet"}</span>
            {:else}<span class="t-muted">First player unknown</span>{/if}
          </span>
          <span class="fp-lad__when">
            {#if when.state === "at"}<time datetime={iso(when.at)} title={dateTime(when.at)}>{ago(when.at)}</time>
            {:else if when.state === "before"}<span class="fp-tag">Reached before tracking began</span>{/if}
          </span>
        </li>
      {/each}
    </ol>
  {/if}
{/if}

<style>
  .fp-lad__head { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
  .fp-lad { display: flex; flex-direction: column; gap: 2px; }
  .fp-lad__rung { display: grid; grid-template-columns: 96px minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); min-height: 44px; padding: 0 var(--space-3); border-radius: var(--radius-lg); }
  .fp-lad__rung--todo { opacity: 0.8; }
  .fp-lad__rung--next { background: var(--acc-soft); opacity: 1; }
  .fp-lad__thr { font: 600 14px/20px var(--font-mono); font-variant-numeric: tabular-nums; }
  .fp-lad__rung--todo .fp-lad__thr { color: var(--muted); font-weight: 400; }
  .fp-lad__who { min-width: 0; font: 400 14px/20px var(--font-text); }
  .fp-lad__when { font: 400 12px/16px var(--font-mono); color: var(--faint); text-align: right; }
  @media (max-width: 640px) { .fp-lad__rung { grid-template-columns: 72px minmax(0, 1fr) auto; } .fp-lad__when .fp-tag { white-space: normal; height: auto; } }
</style>
