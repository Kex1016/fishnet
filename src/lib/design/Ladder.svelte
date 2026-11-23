<script lang="ts">
  // A ladder of steps as squares: a milestone's thresholds (reached, the next one, not reached yet) or One
  // Soul's turns (the dead, the one alive now). The state is in the frame and in the title, never colour alone.
  import type { LadderStep } from "./types.ts";
  let { steps, label }: { steps: LadderStep[]; label: string } = $props();
  const cls = (s: LadderStep["state"]) => (s === "next" ? "now" : s === "plain" ? undefined : s);
</script>

<div class="fx-turns" aria-label={label}>
  {#each steps as s, i (s.key ?? i)}
    {#if s.href}
      <a class={cls(s.state)} href={s.href} title={s.title} aria-label={s.title}>{s.label}</a>
    {:else}
      <span class={cls(s.state)} title={s.title} aria-label={s.title}>{s.label}</span>
    {/if}
  {/each}
</div>
