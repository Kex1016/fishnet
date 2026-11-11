<script lang="ts">
  // A clock that ticks in the browser between polls (WEBSITE-BRIEF §10): counts `ms` down (or up) from the
  // moment the answer was made, stands still while `running` is false, and resyncs whenever new props come.
  // Under reduced motion it still ticks numerically (the brief allows that); nothing moves.
  import { onMount } from "svelte";
  import { clock, life } from "./format.ts";
  let { ms, from, dir = "down", running = true, style = "clock" }: { ms: number; from: number; dir?: "down" | "up"; running?: boolean; style?: "clock" | "life" } = $props();
  let now = $state(0);
  onMount(() => {
    now = Date.now();
    const t = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(t);
  });
  const value = $derived.by(() => {
    const passed = running && now ? Math.max(0, now - from) : 0;
    return Math.max(0, dir === "down" ? ms - passed : ms + passed);
  });
</script>

<span class="t-num t-tabular">{style === "clock" ? clock(value) : life(value)}</span>
