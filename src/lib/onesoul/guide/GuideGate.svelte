<script lang="ts">
  // What a guide page says when it has no guide to show (never published, or cakeutils down with nothing kept),
  // and the notice above one that is the last good copy. The page's content is the children.
  import type { Snippet } from "svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { asOf as asOfText } from "#lib/format/dates.ts";
  let { has, why, stale = false, at = 0, children }: { has: boolean; why: "none" | "down" | null; stale?: boolean; at?: number; children: Snippet } = $props();
</script>

{#if !has}
  {#if why === "down"}
    <Notice kind="warning">The guide could not be loaded right now, and this site has no earlier copy of it.</Notice>
  {:else}
    <EmptyState title="The guide is not published yet" line="The One Soul server sends it when it starts. Check back after the next restart." />
  {/if}
{:else}
  {#if stale}
    <Notice kind="warning">The One Soul server could not be reached. This is the last good copy of the guide, {asOfText(at)}.</Notice>
  {/if}
  {@render children()}
{/if}
