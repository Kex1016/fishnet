<script lang="ts" generics="T">
  // Internal: the states every milestone list shares (PLAN §3.5). `off` is the caller's job (it renders
  // nothing at all); everything else is decided here, on purpose, with the final copy.
  import type { Snippet } from "svelte";
  import type { Result } from "#lib/api/result.ts";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  let {
    result,
    what = "milestones",
    emptyTitle = "No milestones yet",
    emptyLine = "The first player to reach a threshold shows up here.",
    children
  }: { result: Result<T>; what?: string; emptyTitle?: string; emptyLine?: string; children: Snippet<[T]> } = $props();
</script>

{#if !result.ok}
  {#if result.kind === "down"}
    <Notice kind="warning">
      <b>cakeutils could not be reached.</b> The {what} will be back when it is.
      {#if result.asOf}<AsOf at={result.asOf} stale />{/if}
    </Notice>
  {:else if result.kind === "rate_limited"}
    <Notice kind="info"><b>The site is busy.</b> The {what} will load again in a moment{#if result.retryAfter}, in about {result.retryAfter} s{/if}.</Notice>
  {:else if result.kind === "not_found"}
    <EmptyState title="Nobody has done this yet" />
  {:else}
    <EmptyState title="No {what} for this view" line="Try another scope or stat type." />
  {/if}
{:else}
  {#if result.stale}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> Showing the last good data, <AsOf at={result.asOf} stale />.</Notice>
  {/if}
  {#if result.empty}
    <EmptyState title={emptyTitle} line={emptyLine} />
  {:else}
    {@render children(result.data)}
  {/if}
{/if}
