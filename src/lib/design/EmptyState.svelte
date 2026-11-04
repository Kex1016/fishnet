<script lang="ts">
  // A calm empty state (PLAN §3.5): one line, optional "Recording since". Sentence case, no exclamation marks.
  import type { Snippet } from "svelte";
  import type { Component } from "svelte";
  import { Fish } from "@lucide/svelte";
  import { day } from "#lib/format/dates.ts";
  let {
    title,
    line,
    since,
    icon: Icon = Fish,
    children
  }: {
    title: string;
    line?: string;
    /** epoch ms when the recorder started; renders "Recording since 4 Nov 2026" */
    since?: number | null;
    icon?: Component<{ class?: string; strokeWidth?: number }>;
    children?: Snippet;
  } = $props();
</script>

<div class="fp-empty" role="status">
  <Icon class="fp-ico" strokeWidth={1.4} />
  <div class="fp-empty__title">{title}</div>
  {#if line}<div class="fp-empty__line">{line}</div>{/if}
  {#if since}<div class="fp-empty__since">Recording since {day(since)}</div>{/if}
  {#if children}{@render children()}{/if}
</div>
