<script lang="ts">
  // The head of a page, straight on the blobs: a prompt line, the display title (Jacquard 24, as large as its
  // words allow), a line of narration in rose and, as children, what switches the page (a Segmented, filters,
  // a row of ink links).
  import type { Snippet } from "svelte";
  import PromptLine from "./PromptLine.svelte";
  import { titleEm } from "./shell.ts";
  let {
    path,
    cmd = "cat",
    args,
    title,
    lede,
    note,
    children
  }: {
    /** the prompt's place; "fishplex" when left out */
    path?: string;
    cmd?: string;
    args?: string;
    /** the display title: a section's word in lower case ("players"), or a name in its own spelling */
    title: string;
    /** narration, rose, with a gold initial */
    lede?: string;
    /** a quiet second line */
    note?: string;
    children?: Snippet;
  } = $props();
  const longest = $derived(Math.max(...title.split(/\s+/).map(titleEm)));
</script>

<section class="fx-head">
  <PromptLine {path} {cmd} {args} />
  <h1 class="title" style="--fx-title-em: {longest}">{title}</h1>
  {#if lede}<p class="lede">{lede}</p>{/if}
  {#if note}<p class="c1">{note}</p>{/if}
  {#if children}{@render children()}{/if}
</section>
