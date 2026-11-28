<script lang="ts">
  // One timeline row as a feed row: a mark, who and what, a quiet second line for a quoted cause or label,
  // and when. Names, death causes and waystone labels are player text (escaped by Svelte, shown as quotes);
  // unknown kinds read as their title-cased id. No positions are rendered here.
  import { ago, dateTime, iso } from "#lib/format/dates.ts";
  import { eventHasActor, eventLine } from "./format.ts";
  import type { OsEvent } from "./types.ts";
  let { e, now }: { e: OsEvent; now: number } = $props();
  const l = $derived(eventLine(e));

  // a mark and an ink per kind; the sentence says the same thing, the mark only helps the eye
  const MARKS: Record<string, [string, string]> = {
    soul_chosen: ["☼", "c6"],
    second_chance: ["♥", "c4"],
    offering: ["♥", "c4"],
    second_chance_ended: ["♥", "c4"],
    death: ["✝", "c2"],
    grave_created: ["⌂", "c7"],
    grave_claimed: ["⌂", "c3"],
    waystone_activated: ["»", "c3"],
    rift_stable: ["○", "c3"],
    nether_entered: ["▲", "c2"],
    end_opened: ["◙", "c6"],
    end_entered: ["►", "c6"],
    torch_passed: ["♪", "c4"],
    prank: ["☻", "c7"]
  };
  const TONES: Record<string, [string, string]> = { death: ["✝", "c2"], soul: ["☼", "c6"], grave: ["⌂", "c7"], round: ["◘", "c3"], ghost: ["☻", "c7"], other: ["»", "c1"] };
  const m = $derived(MARKS[e.kind] ?? TONES[l.tone]);
</script>

<div class="li os-ev">
  <span class="os-ev__mk {m[1]}" aria-hidden="true">{m[0]}</span>
  <span class="txt">
    <span>{#if eventHasActor(e)}<a class="lnk" href="/players/{encodeURIComponent(e.name ?? '')}">{e.name}</a> {l.text}{:else}{l.text}{/if}</span>
    {#if l.quote}<span class="sub"><q>{l.quote}</q></span>{/if}
  </span>
  <time class="when" datetime={iso(e.at)} title={dateTime(e.at)}>{e.kind === "prank" ? dateTime(e.at).split(",")[0] : ago(e.at, now)}</time>
</div>

<style>
  .os-ev__mk {
    flex: none;
    width: 2ch;
    text-align: center;
  }
  .txt {
    overflow-wrap: anywhere;
  }
</style>
