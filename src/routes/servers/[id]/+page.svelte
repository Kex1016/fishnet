<script lang="ts">
  import { page } from "$app/state";
  import Notice from "#lib/design/Notice.svelte";
  import Stub from "#lib/design/Stub.svelte";
  import { BarList, UptimeStrip, viewParam } from "#lib/charts/index.ts";
  import { boardHref } from "#lib/api/metric.ts";
  let { data } = $props();
  const view = $derived(viewParam(page.url));
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">Server</span>
    <h1 class="t-display">{data.server?.display_name ?? page.params.id}</h1>
    {#if data.server}<p class="fp-lede">{data.server.mc_version ? `${data.server.platform} ${data.server.mc_version}` : "Not linked right now"} · <span class="t-num">{data.server.online}</span> online</p>{/if}
    <Stub unit="W4" what="this page" />
  </header>
  {#if !data.network.ok}<Notice kind="warning"><b>cakeutils could not be reached.</b></Notice>{/if}
  <div class="fp-panels">
    <UptimeStrip title="Last 7 days" sub="online and linked" since={data.hist.since} samples={data.hist.samples} {view} emptyTitle="No history yet" />
    <BarList
      title="Playtime here"
      href={boardHref({ kind: "playtime" }, `server:${page.params.id}`)}
      sub="server · top 10"
      {view}
      faces
      unit="ms"
      emptyTitle="No one has played on this server yet"
      rows={data.playtime.ok ? data.playtime.data.entries.map((e) => ({ rank: e.rank, key: e.uuid, uuid: e.uuid, label: e.name, v: e.value, display: e.display, href: `/players/${encodeURIComponent(e.name)}` })) : []}
    />
  </div>
</div>
