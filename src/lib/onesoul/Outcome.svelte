<script lang="ts">
  // An outcome as a mark and a word: state never rests on colour alone (WEBSITE-BRIEF §4).
  import { outcomeLabel } from "./format.ts";
  let { outcome }: { outcome: string } = $props();
  const MARKS: Record<string, [string, string]> = { playing: ["☼", "c3"], died: ["✝", "c2"], skipped: ["○", "c1"], round_ended: ["◘", "c1"], replaced: ["↔", "c1"] };
  const m = $derived(MARKS[outcome] ?? ["·", "c1"]);
</script>

<span class="os-outcome {m[1]}"><span aria-hidden="true">{m[0]}</span> {outcomeLabel(outcome)}</span>

<style>
  .os-outcome {
    white-space: nowrap;
  }
</style>
