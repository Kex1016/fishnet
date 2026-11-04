<script lang="ts">
  import { page } from "$app/state";
  import { SITE } from "#lib/nav.ts";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Stub from "#lib/design/Stub.svelte";
  import { BarList, LineChart, StatTile, ViewSwitch, viewParam } from "#lib/charts/index.ts";
  import { MilestoneFeed } from "#lib/milestones/index.ts";
  import { boardHref } from "#lib/api/metric.ts";
  let { data } = $props();
  const view = $derived(viewParam(page.url));
  const net = $derived(data.network);
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">{SITE.host}</span>
    <h1 class="t-hero">{SITE.name}</h1>
    <p class="fp-lede t-body-lg">Who is on, the servers, players and their stats, leaderboards and milestones. Every number comes from the network.</p>
    <Stub unit="W4" what="the home page" />
  </header>

  <section class="fp-section">
    <div class="fp-section__head">
      <h2 class="t-title-2">Right now</h2>
      {#if net.ok}<AsOf at={net.asOf} stale={net.stale} />{/if}
    </div>
    {#if !net.ok}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> The network's status will be back when it is.</Notice>
    {:else}
      <div class="fp-tiles">
        <StatTile label="Online now" value={String(net.data.total_online)} note={net.data.servers.some((s) => s.waiting) ? `${net.data.servers.reduce((a, s) => a + s.waiting, 0)} waiting` : undefined} />
        {#each net.data.servers as s (s.id)}
          <StatTile label={s.display_name} value={String(s.online)} unit={s.mc_version ? `${s.platform ?? ""} ${s.mc_version}`.trim() : "not linked"} note={s.waiting ? `${s.waiting} waiting` : undefined} href="/servers/{s.id}" />
        {/each}
      </div>
    {/if}
  </section>

  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-3"><a href="/players?online=true">Online players</a></h2></div>
    {#if data.online.ok && !data.online.empty}
      <div class="fp-faces">
        {#each data.online.data.players as p (p.uuid)}<a href="/players/{encodeURIComponent(p.name)}" title={p.name}><Face uuid={p.uuid} name={p.name} /></a>{/each}
      </div>
    {:else if data.online.ok}
      <EmptyState title="Nobody is online right now" />
    {/if}
  </section>

  <div class="fp-filters" style="justify-content: flex-end"><ViewSwitch url={page.url} {view} /></div>
  <div class="fp-panels">
    <BarList
      title="Playtime"
      href={boardHref({ kind: "playtime" })}
      sub="network · top 5"
      {view}
      faces
      unit="ms"
      asOf={data.playtime.ok ? data.playtime.asOf : undefined}
      stale={data.playtime.ok && data.playtime.stale}
      emptyTitle="No one has played yet"
      rows={data.playtime.ok ? data.playtime.data.entries.map((e) => ({ rank: e.rank, key: e.uuid, uuid: e.uuid, label: e.name, v: e.value, display: e.display, href: `/players/${encodeURIComponent(e.name)}` })) : []}
    />
    <LineChart title="Online over the week" sub="network · players online" since={data.since} {view} points={data.onlineWeek.points} emptyTitle="No history yet" emptyLine="Online counts are recorded every minute once the site is live." />
  </div>

  <MilestoneFeed result={data.milestones} href="/milestones" />
</div>
