<script lang="ts">
  import { page } from "$app/state";
  import { SITE } from "#lib/nav.ts";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { BarList, ColumnChart, Heatmap, LineChart, StatTile, ViewSwitch, viewParam } from "#lib/charts/index.ts";
  import { HOURS, meanPlayers } from "./servers/boards.ts";
  import { AdvancementFeed, MilestoneFeed } from "#lib/milestones/index.ts";
  import { boardHref, PLAYTIME } from "#lib/api/metric.ts";
  import { titleCase } from "#lib/players/names.ts";
  let { data } = $props();
  const view = $derived(viewParam(page.url));
  const net = $derived(data.network);
  const names = $derived(net.ok ? Object.fromEntries(net.data.servers.map((s) => [s.id, s.display_name])) : {});
  // Players waiting for a server are people, so adding them across servers counts people, not scopes.
  const waiting = $derived(net.ok ? net.data.servers.reduce((a, s) => a + s.waiting, 0) : 0);
  const build = (platform: string | null, version: string | null) => (version ? `${platform ? titleCase(platform) : "Server"} ${version}` : "Not linked");
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">{SITE.host}</span>
    <h1 class="t-hero">{SITE.name}</h1>
    <p class="fp-lede t-body-lg">Who is on, the servers, players and their stats, leaderboards, milestones and advancements. Every number comes from the network.</p>
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
        <StatTile
          label="Online now"
          value={String(net.data.total_online)}
          note={waiting ? `${waiting} waiting` : undefined}
          spark={data.onlineRecent.points.length >= 2 ? data.onlineRecent.points : undefined}
          sparkLabel="Players online, recent"
        />
        {#each net.data.servers as s (s.id)}
          <StatTile label={s.display_name} value={String(s.online)} unit="online" note={`${build(s.platform, s.mc_version)}${s.waiting ? ` · ${s.waiting} waiting` : ""}`} href="/servers/{s.id}" />
        {/each}
      </div>
      {#if net.data.servers.length === 0}
        <EmptyState title="No servers are linked yet" line="Servers show up here as soon as they connect to the network." />
      {/if}
    {/if}
  </section>

  <section class="fp-section">
    <div class="fp-section__head">
      <h2 class="t-title-3"><a href="/players?online=true">Online players</a></h2>
      {#if data.online.ok}<span class="t-small t-muted"><span class="t-num">{data.online.data.total}</span> online</span>{/if}
    </div>
    {#if !data.online.ok}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> Who is online will be back when it is.</Notice>
    {:else if data.online.empty || data.online.data.players.length === 0}
      <EmptyState title="Nobody is online right now" line="Players appear here while they are on the network." />
    {:else}
      <div class="fp-faces">
        {#each data.online.data.players as p (p.uuid)}
          <a href="/players/{encodeURIComponent(p.name)}" title={p.server ? `${p.name} · ${names[p.server] ?? p.server}` : p.name}><Face uuid={p.uuid} name={p.name} /></a>
        {/each}
      </div>
    {/if}
  </section>

  <section class="fp-section">
    <div class="fp-section__head">
      <h2 class="t-title-3">The network in numbers</h2>
      {#if data.totals.kind === "tiles"}<AsOf at={data.totals.asOf} stale={data.totals.stale} />{/if}
    </div>
    {#if data.totals.kind === "down"}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> The network's totals will be back when it is.</Notice>
    {:else if data.totals.kind === "empty"}
      <EmptyState title="Nobody has played on the network yet" line="Totals appear once the first player has logged in." />
    {:else}
      {#if data.totals.missing}<Notice kind="warning"><b>Some totals could not be loaded.</b> They will be back when cakeutils is.</Notice>{/if}
      <div class="fp-tiles">
        {#each data.totals.tiles as t (t.key)}
          <StatTile label={t.label} value={t.value} note={t.note} href={t.href} spark={t.spark} sparkLabel="{t.label}, last 30 days" />
        {/each}
      </div>
    {/if}
  </section>

  <div class="fp-filters" style="justify-content: flex-end"><ViewSwitch url={page.url} {view} /></div>
  <div class="fp-panels">
    {#if data.top.ok}
      <BarList
        title="Playtime"
        href={boardHref(PLAYTIME)}
        sub="network · top 5"
        {view}
        faces
        unit="ms"
        asOf={data.top.asOf}
        stale={data.top.stale}
        emptyTitle="No one has played yet"
        emptyLine="The players with the most time on the network show up here."
        rows={data.top.rows}
      />
    {:else}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> The playtime board will be back when it is.</Notice>
    {/if}
    <LineChart
      title="Online over the week"
      sub="network · players online"
      since={data.onlineWeek.since}
      {view}
      points={data.onlineWeek.points}
      emptyTitle="No history yet"
      emptyLine="Online counts are recorded every minute once the site is live."
    />
    <ColumnChart
      title="New players per week"
      sub="network · by first login"
      since={data.joins.since}
      {view}
      points={data.joins.points}
      emptyTitle="Not enough weeks yet"
      emptyLine="New players are counted by the week they first logged in."
    />
    <Heatmap
      title="Busiest hours"
      sub="network · mean players online · last 30 days · UTC"
      since={data.busiestHours.since ?? data.since}
      {view}
      rows={data.busiestHours.rows}
      columns={HOURS}
      format={meanPlayers}
      cellLabel={(r, c) => `${r} ${c}:00`}
      emptyTitle="No history yet"
      emptyLine="The busiest hours show up after a few days of recording."
    />
  </div>

  <MilestoneFeed result={data.milestones} href="/milestones" />
  <AdvancementFeed result={data.advancements} href="/advancements" serverNames={data.serverNames} />
</div>
