<script lang="ts">
  import { page } from "$app/state";
  import Pager from "#lib/design/Pager.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Stub from "#lib/design/Stub.svelte";
  import { MilestoneFeed } from "#lib/milestones/index.ts";
  let { data } = $props();
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Milestones</h1>
    <p class="fp-lede">Who was first to each threshold, newest first.</p>
    <Stub unit="W7" what="this page" />
  </header>
  {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
  <MilestoneFeed result={data.feed} title="Feed" limit={data.limit} />
  {#if data.feed.ok}<Pager url={page.url} total={data.feed.data.total} limit={data.limit} offset={data.offset} what="milestones" />{/if}
</div>
