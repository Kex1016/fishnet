<script lang="ts">
  // A popout over the map (FM-3; David, 15 Nov 2026): a chip that opens a floating panel (a sheet across the
  // bottom on a phone). A <details>, so it opens without JavaScript and the keyboard works by itself; popouts
  // that share `group` close each other. Escape and a click outside close it. Classes in map.css (`mc-pop`).
  import type { Component, Snippet } from "svelte";
  let { label, value, count, icon: Icon, group = "mc-pop", open = $bindable(false), children }: {
    /** what the popout holds: "Worlds", "Players", "Layers" (the chip's accessible name and the panel's title) */
    label: string;
    /** shown on the chip instead of the label, e.g. the world's name (plain text) */
    value?: string;
    count?: number;
    icon?: Component<{ class?: string; strokeWidth?: number }>;
    group?: string;
    open?: boolean;
    children: Snippet;
  } = $props();
  let el: HTMLDetailsElement;

  function onkey(e: KeyboardEvent) {
    if (e.key !== "Escape" || !el.open) return; // the element, not the state: its toggle event comes a moment later
    el.open = false;
    open = false;
    el.querySelector("summary")?.focus();
  }
  function outside(e: MouseEvent) {
    if (!el.open || !(e.target instanceof Node) || el.contains(e.target)) return;
    el.open = false;
    open = false;
  }
</script>

<svelte:document onclick={outside} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions: Escape closes the popout from anywhere inside it -->
<details class="mc-pop" name={group} bind:this={el} bind:open onkeydown={onkey}>
  <summary class="fp-chip" aria-label={value !== undefined ? `${label}: ${value}` : count !== undefined ? `${label}, ${count}` : label} title={label}>
    {#if Icon}<Icon class="fp-ico fp-ico--sm" strokeWidth={1.6} />{/if}
    <span>{value ?? label}</span>
    {#if count !== undefined}<span class="mc-pop__count">{count}</span>{/if}
  </summary>
  <div class="mc-pop__panel" role="group" aria-label={label}>
    <span class="mc-pop__title">{label}</span>
    {@render children()}
  </div>
</details>
