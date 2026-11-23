<script lang="ts">
  // A calm empty state (PLAN §3.5): a dashed frame, a title, one line, optional "Recording since". Sentence
  // case, no exclamation marks. Sits inside a window, or straight in the page.
  import type { Snippet } from "svelte";
  import { day } from "#lib/format/dates.ts";
  let {
    title,
    line,
    since,
    children
  }: {
    title: string;
    line?: string;
    /** epoch ms when the recorder started; renders "Recording since 4 Nov 2026" */
    since?: number | null;
    /** @deprecated haiiro has no icon set: ignored. Units drop it as they rebuild their pages. */
    icon?: unknown;
    children?: Snippet;
  } = $props();
</script>

<div class="fx-empty" role="status">
  <b>{title}</b>{line ?? ""}
  {#if since}<span class="since">Recording since {day(since)}</span>{/if}
  {#if children}{@render children()}{/if}
</div>
