<script lang="ts">
  // A popout over the map (FM-3; David, 15 Nov 2026), in the haiiro look (H7): a word in the map's bar that opens a
  // window under it (a sheet above the docked bar on a phone). A <details>, so it opens without JavaScript and the
  // keyboard works by itself; popouts that share `group` close each other. Escape and a click outside close it.
  // Classes in map.css (`mc-pop`). The window's heading is a prompt: `fish: <path> <cmd>`.
  import type { Snippet } from "svelte";
  let { label, value, count, icon: _icon, path = "~/map", cmd, group = "mc-pop", open = $bindable(false), children }: {
    /** what the popout holds: "Worlds", "Players", "Layers" (the chip's accessible name) */
    label: string;
    /** shown on the chip instead of the label, e.g. the world's name (plain text) */
    value?: string;
    count?: number;
    /** accepted and ignored: haiiro has no icons on the map (deprecated) */
    icon?: unknown;
    /** the place in the window's prompt heading */
    path?: string;
    /** the command in the window's prompt heading; the label in lower case without it */
    cmd?: string;
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
  <summary aria-label={value !== undefined ? `${label}: ${value}` : count !== undefined ? `${label}, ${count}` : label} title={label}>
    {#if value !== undefined}<span class="mc-pop__value">{value}</span><span class="mc-pop__word">{label.toLowerCase()}</span>{:else}<span>{label.toLowerCase()}</span>{/if}
    {#if count !== undefined}<span class="mc-pop__count">{count}</span>{/if}
  </summary>
  <div class="mc-pop__panel window" role="group" aria-label={label}>
    <span class="section-header" aria-hidden="true">fish: <b>{path}</b> {cmd ?? label.toLowerCase()}</span>
    <div class="mc-pop__body">
      {@render children()}
    </div>
  </div>
</details>
