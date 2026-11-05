<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { BarList, Heatmap, LineChart, StatTile, UptimeStrip, ViewSwitch, viewParam } from "#lib/charts/index.ts";
  import { AdvancementFeed, MilestoneFeed } from "#lib/milestones/index.ts";
  import { boardHref, PLAYTIME } from "#lib/api/metric.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { titleCase } from "#lib/players/names.ts";
  import { HOURS, meanPlayers } from "../boards.ts";
  let { data } = $props();
  const view = $derived(viewParam(page.url));
  const s = $derived(data.server);
  const linked = $derived(!!s?.mc_version);
  const pt = $derived(data.playtime);
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">Server</span>
    <h1 class="t-display">{data.name}</h1>
    {#if s}
      <p class="fp-lede">
        {#if linked}<span class="fp-tag fp-tag--success">{s.platform ? titleCase(s.platform) : "Server"} {s.mc_version}</span>{:else}<span class="fp-tag">not linked</span> This server is not connected to the network right now.{/if}
      </p>
    {/if}
  </header>

  {#if !data.network.ok}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> This server's status will be back when it is.</Notice>
  {:else if !linked}
    <Notice kind="info"><b>Not linked right now.</b> The numbers below are what the network has recorded here so far.</Notice>
  {/if}

  <section class="fp-section">
    <div class="fp-section__head">
      <h2 class="t-title-2">Right now</h2>
      {#if data.network.ok}<AsOf at={data.network.asOf} stale={data.network.stale} />{/if}
    </div>
    <div class="fp-tiles">
      {#if s}
        <StatTile label="Online now" value={String(s.online)} spark={data.onlineRecent.points.length >= 2 ? data.onlineRecent.points : undefined} sparkLabel="Players online here, recent" />
        <StatTile label="Waiting" value={String(s.waiting)} note="in the queue for this server" />
      {/if}
      {#if pt.ok && !pt.empty}
        <StatTile label="Players" value={group(pt.players)} note="have played here" href={boardHref(PLAYTIME, data.scope)} />
        <StatTile label="Time played" value={pt.time} note="on this server" href={boardHref(PLAYTIME, data.scope)} />
      {/if}
    </div>
    {#if data.faces.length}
      <div class="fp-faces">
        {#each data.faces as p (p.uuid)}<a href="/players/{encodeURIComponent(p.name)}" title={p.name}><Face uuid={p.uuid} name={p.name} /></a>{/each}
      </div>
    {:else if s}
      <EmptyState title="Nobody is on right now" line="Players appear here while they are on this server." />
    {/if}
  </section>

  <div class="fp-filters" style="justify-content: flex-end"><ViewSwitch url={page.url} {view} /></div>
  <div class="fp-panels">
    <LineChart
      title="Online over the week"
      sub="{data.name} · players online"
      since={data.onlineWeek.since ?? data.since}
      {view}
      points={data.onlineWeek.points}
      shadow={data.waiting.length ? { label: "Waiting", points: data.waiting } : undefined}
      emptyTitle="No history yet"
      emptyLine="Online counts are recorded every minute once the site is live."
    />
    <UptimeStrip
      title="Last 7 days"
      sub="{data.name} · online and linked"
      since={data.since}
      samples={data.samples}
      {view}
      emptyTitle="No history yet"
      emptyLine="Whether the server was linked is recorded every minute once the site is live."
    />
    <Heatmap
      title="Busiest hours"
      sub="{data.name} · mean players online · last 30 days · UTC"
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

  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-2">On this server</h2></div>
    {#if !pt.ok && pt.outage}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> This server's boards will be back when it is.</Notice>
    {:else}
      {#if data.outage}<Notice kind="warning"><b>Some boards could not be loaded.</b> They will be back when cakeutils is.</Notice>{/if}
      <div class="fp-panels">
        <BarList
          title="Playtime here"
          href={boardHref(PLAYTIME, data.scope)}
          sub="server · top 5"
          {view}
          faces
          unit="ms"
          asOf={pt.ok ? pt.asOf : undefined}
          stale={pt.ok && pt.stale}
          emptyTitle="No one has played on this server yet"
          emptyLine="The players with the most time here show up on this board."
          rows={pt.ok && !pt.empty ? pt.rows : []}
        />
        {#each data.boards as b (b.id)}
          <BarList title={b.label} href={b.href} sub="server · top 5" {view} faces unit={b.unit} asOf={b.asOf} stale={b.stale} emptyTitle="Nobody has done this yet" rows={b.rows} />
        {/each}
      </div>
    {/if}
  </section>

  {#if data.live.length || data.busiest.length}
    <section class="fp-section">
      <div class="fp-section__head"><h2 class="t-title-2">Mini-servers</h2></div>
      <div class="fp-panels">
        {#if data.live.length}
          <section class="fp-card">
            <header class="fp-card__head">
              <div><h3 class="fp-card__title">Running now</h3><div class="fp-card__sub">public mini-servers on {data.name}</div></div>
            </header>
            <div class="fp-card__body">
              <ul class="fp-rows">
                {#each data.live as m (m.id)}
                  <li class="fp-row" style="grid-template-columns: minmax(0, 1fr) auto">
                    <span class="fp-row__name">{m.name}</span>
                    <span class="fp-row__value">{m.count} {m.count === 1 ? "player" : "players"}</span>
                  </li>
                  {#if m.players.length}
                    <li class="fp-faces" style="padding: 0 var(--space-3) var(--space-2)">
                      {#each m.players as p (p.uuid)}<a href="/players/{encodeURIComponent(p.name)}" title={p.name}><Face uuid={p.uuid} name={p.name} size="sm" /></a>{/each}
                    </li>
                  {/if}
                {/each}
              </ul>
            </div>
          </section>
        {/if}
        {#if data.busiest.length}
          <BarList title="Busiest mini-servers" sub="peak players this week" since={data.since} {view} rows={data.busiest} emptyTitle="No mini-servers yet" />
        {/if}
      </div>
    </section>
  {/if}

  <MilestoneFeed result={data.milestones} title="Latest milestones here" href="/milestones?scope={encodeURIComponent(data.scope)}" />
  <AdvancementFeed result={data.advancements} title="Advancements completed here first" href="/advancements?scope={encodeURIComponent(data.scope)}" showServer={false} />
</div>
