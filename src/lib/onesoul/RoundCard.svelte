<script lang="ts">
  // One round as a window: its dates, souls, time survived, longest life, graves. Counts are inside the
  // round only. The running round has the gold frame (the living), a finished one the plain pine.
  import type { RoundSummary } from "#lib/server/onesoul/section.ts";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import KeyValueSheet from "#lib/design/KeyValueSheet.svelte";
  import type { SheetRow } from "#lib/design/types.ts";
  import { day } from "#lib/format/dates.ts";
  import { life, stateLabel } from "./format.ts";
  import { osHref } from "./links.ts";
  let { r, current }: { r: RoundSummary; current: boolean } = $props();

  const when = $derived(r.started_at ? `${day(r.started_at)}${r.ended_at ? ` to ${day(r.ended_at)}` : ""}` : "world not opened yet");
  const rows = $derived.by(() => {
    const out: SheetRow[] = [
      { label: "souls", value: String(r.souls), num: true },
      { label: "time survived", value: life(r.total_survival_ms), num: true }
    ];
    if (r.longest) out.push({ label: "longest life", value: `${life(r.longest.duration_ms)}, ${r.longest.name}`, num: true });
    if (r.graves) out.push({ label: "graves claimed", value: r.graves.total ? `${r.graves.claimed} of ${r.graves.total}` : "none", num: true });
    if (r.registered !== null) out.push({ label: "signed up", value: String(r.registered), num: true });
    return out;
  });
</script>

<Window tag="article" path="~/one-soul/rounds/{r.cycle}" tone={current ? "gold" : "pine"}>
  <WindowHead title="Round {r.cycle}" href={osHref.round(r.cycle)} asof={current ? (r.state ? stateLabel(r.state) : "now") : "over"} />
  <p class="c1">{when}</p>
  <div class="os-sheet"><KeyValueSheet {rows} /></div>
</Window>

<style>
  .os-sheet {
    margin-top: 12px;
  }
</style>
