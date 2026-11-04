<script lang="ts">
  import { page } from "$app/state";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Stub from "#lib/design/Stub.svelte";
  import { DataTable } from "#lib/charts/index.ts";
  import { problemCode } from "#lib/api/result.ts";
  let { data } = $props();
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">Leaderboard</span>
    <h1 class="t-display">{data.metric.kind === "playtime" ? "Playtime" : page.params.metric}</h1>
    <Stub unit="W6" what="this page" />
  </header>
  {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
  {#if !data.board.ok}
    {#if data.board.kind === "not_found"}<EmptyState title="Nobody has done this yet" />
    {:else if data.board.kind === "bad_request" && problemCode(data.board) === "mixed_units"}<EmptyState title="Custom stats have mixed units" line="Pick one custom stat instead of the type total." />
    {:else}<Notice kind="warning"><b>cakeutils could not be reached.</b></Notice>{/if}
  {:else if data.board.empty}
    <EmptyState title="No one has played here yet" />
  {:else}
    <DataTable columns={[{ key: "rank", label: "#", num: true }, { key: "name", label: "Player" }, { key: "display", label: "Value", num: true }]} rows={data.board.data.entries} caption="Leaderboard" />
    <Pager url={page.url} total={data.board.data.total} limit={data.limit} offset={data.offset} what="players" />
  {/if}
</div>
