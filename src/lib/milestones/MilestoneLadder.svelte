<script lang="ts">
  // One stat's ladder, lowest rung first (at most 18): who was first to each, when, and the next one to
  // reach. Thresholds are data: `display` as the API gives it, no table of 1/100/1000 here.
  import type { MilestoneLadderProps } from "./types.ts";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import Feed from "#lib/design/Feed.svelte";
  import Ladder from "#lib/design/Ladder.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { problemCode } from "#lib/api/result.ts";
  import { ago, day } from "#lib/format/dates.ts";
  import { nextRung, whenOf, whoOf } from "./helpers.ts";
  import When from "./When.svelte";
  let { result, statName, icon, kind }: MilestoneLadderProps = $props();
  const next = $derived(result.ok ? nextRung(result.data.milestones) : -1);
  // the squares: every rung as reached, the next one, or not reached yet; the title says it in words
  const steps = $derived(
    result.ok
      ? result.data.milestones.map((m, i) => {
          const w = whenOf(m);
          const who = whoOf(m);
          const state: "reached" | "next" | "locked" = w.state === "none" ? (i === next ? "next" : "locked") : "reached";
          const title =
            state === "reached"
              ? `${m.display}: first reached by ${who?.name ?? "an unknown player"}${w.state === "at" ? `, ${day(w.at)}` : ", before tracking began"}`
              : state === "next"
                ? `${m.display}: next to reach`
                : `${m.display}: not reached yet`;
          return { key: String(m.threshold), label: m.display, state, title };
        })
      : []
  );
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
    <div class="head">
      <Slot {icon} {kind} name={statName} />
      <b>{statName}</b>
    </div>
  {/if}
  {#if result.data.milestones.length === 0}
    <EmptyState title="No milestones yet" line="The first player to reach a threshold shows up here." />
  {:else}
    <div class="fx-stack">
    <Ladder {steps} label="Milestone ladder" />
    <Feed label="Milestones, lowest first">
      {#each result.data.milestones as m, i (m.threshold)}
        {@const who = whoOf(m)}
        {@const when = whenOf(m)}
        <div class="li" aria-current={i === next ? "step" : undefined}>
          <span class="thr"><b>{m.display}</b></span>
          <span class="txt">
            {#if who}<PlayerName uuid={who.uuid} name={who.name} />
            {:else if when.state === "none"}<span class="c1">{i === next ? "Next to reach" : "Not reached yet"}</span>
            {:else}<span class="c1">First player unknown</span>{/if}
          </span>
          {#if when.state !== "none"}<When {when} />{/if}
        </div>
      {/each}
    </Feed>
    </div>
  {/if}
{/if}

<style>
  .head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .thr { flex: none; width: 12ch; }
  .li :global(.when) { margin-left: auto; }
</style>
