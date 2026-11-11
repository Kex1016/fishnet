<script lang="ts">
  // An outcome as an icon and a word: state never rests on colour alone (WEBSITE-BRIEF §4).
  import { Flame, Skull, UserX, Hourglass, Repeat, Circle } from "@lucide/svelte";
  import { outcomeLabel } from "./format.ts";
  let { outcome }: { outcome: string } = $props();
  const icons: Record<string, typeof Flame> = { playing: Flame, died: Skull, skipped: UserX, round_ended: Hourglass, replaced: Repeat };
  const Icon = $derived(icons[outcome] ?? Circle);
  const tone = $derived(outcome === "playing" ? "acc" : outcome === "died" ? "error" : "");
</script>

<span class="fp-tag {tone ? `fp-tag--${tone}` : ''}"><Icon class="fp-ico fp-ico--sm" strokeWidth={1.4} aria-hidden="true" />{outcomeLabel(outcome)}</span>
