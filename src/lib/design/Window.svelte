<script lang="ts">
  // haiiro's Window: the terminal pane every block of a page sits in. A 5px double frame with a label notched
  // into its top edge, written like a prompt: `fish: ~/players --online`. The frame colour carries meaning:
  // pine by default, gold = needs you or the living, love = critical or failed, foam = done, off = not there.
  import type { Snippet } from "svelte";
  import type { WindowTone } from "./types.ts";
  let {
    shell = "fish",
    path,
    args,
    tone = "pine",
    tag = "section",
    id,
    label,
    foot,
    children
  }: {
    /** the word before the colon in the label */
    shell?: string;
    /** the label's path, e.g. "~/players"; without it the window has no label */
    path?: string;
    /** what follows the path, e.g. "--online" */
    args?: string;
    tone?: WindowTone;
    tag?: "section" | "div" | "nav" | "aside" | "article";
    id?: string;
    /** aria-label, for a nav or a section without a heading */
    label?: string;
    /** the foot line under a hairline: small, muted */
    foot?: Snippet;
    children: Snippet;
  } = $props();
  const cls = $derived(tone === "pine" ? "window" : tone === "off" ? "window fx-off" : `window ${tone}`);
</script>

<svelte:element this={tag} class={cls} {id} aria-label={label}>
  {#if path !== undefined}<span class="section-header">{shell}: <b>{path}</b>{args ? ` ${args}` : ""}</span>{/if}
  <div class="content">{@render children()}</div>
  {#if foot}<div class="foot">{@render foot()}</div>{/if}
</svelte:element>
