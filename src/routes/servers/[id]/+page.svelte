<script lang="ts">
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { BarList, Heatmap, LineChart, StatTile, UptimeStrip } from "#lib/charts/index.ts";
  import { AdvancementFeed, MilestoneFeed } from "#lib/milestones/index.ts";
  import { boardHref, PLAYTIME } from "#lib/api/metric.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { titleCase } from "#lib/players/names.ts";
  import { HOURS, meanPlayers } from "../boards.ts";
  let { data } = $props();
  const s = $derived(data.server);
  const linked = $derived(!!s?.mc_version);
  const pt = $derived(data.playtime);
  const build = $derived(s?.mc_version ? `${s.platform ? titleCase(s.platform) : "Server"} ${s.mc_version}` : undefined);
  const lede = $derived(!s ? undefined : linked ? `${build}, linked to the network.` : "This server is not connected to the network right now.");
</script>

<PageHead path="~/servers" cmd="cd" args={data.id} title={data.name} {lede} />

{#if !data.network.ok}
  <Notice kind="warning"><b>cakeutils could not be reached.</b> This server's status will be back when it is.</Notice>
{:else if !linked}
  <Notice kind="info"><b>Not linked right now.</b> The numbers below are what the network has recorded here so far.</Notice>
{/if}

<Window shell="server" path={data.id} tone={linked ? "pine" : "off"}>
  <WindowHead title="Right now">{#if data.network.ok}<AsOf at={data.network.asOf} stale={data.network.stale} />{/if}</WindowHead>
  <div class="stat-panel fx-tiles">
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
    <div class="hr"></div>
    <div class="fx-faces">
      {#each data.faces as p (p.uuid)}<a href="/players/{encodeURIComponent(p.name)}" title={p.name}><Face uuid={p.uuid} name={p.name} /><span>{p.name}</span></a>{/each}
    </div>
  {:else if s}
    <EmptyState title="Nobody is on right now" line="Players appear here while they are on this server." />
  {/if}
</Window>

{#if data.map}
  <Window path="~/servers/{data.id}" args="--map" tone="foam">
    <div class="list">
      <a class="li" href={data.map.href}>
        <span class="mk">»</span>
        <span class="grow">Map · {data.map.worlds.join(", ")}</span>
        <span class="meta">{data.map.live ? "live positions" : "no live positions"}{data.map.online ? "" : " · map offline"}</span>
      </a>
    </div>
  </Window>
{/if}

<div class="fx-grid">
  <LineChart
    title="Online over the week"
    sub="{data.name} · players online"
    since={data.onlineWeek.since ?? data.since}
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
    emptyTitle="No history yet"
    emptyLine="Whether the server was linked is recorded every minute once the site is live."
  />
  <Heatmap
    title="Busiest hours"
    sub="{data.name} · mean players online · last 30 days · UTC"
    since={data.busiestHours.since ?? data.since}
    rows={data.busiestHours.rows}
    columns={HOURS}
    format={meanPlayers}
    cellLabel={(r, c) => `${r} ${c}:00`}
    emptyTitle="No history yet"
    emptyLine="The busiest hours show up after a few days of recording."
  />
</div>

{#if !pt.ok && pt.outage}
  <Window path="~/servers/{data.id}" args="--boards">
    <WindowHead title="On this server" />
    <Notice kind="warning"><b>cakeutils could not be reached.</b> This server's boards will be back when it is.</Notice>
  </Window>
{:else}
  {#if data.outage}<Notice kind="warning"><b>Some boards could not be loaded.</b> They will be back when cakeutils is.</Notice>{/if}
  <div class="fx-grid">
    <BarList
      title="Playtime here"
      href={boardHref(PLAYTIME, data.scope)}
      sub="server · top 5"
      faces
      unit="ms"
      asOf={pt.ok ? pt.asOf : undefined}
      stale={pt.ok && pt.stale}
      emptyTitle="No one has played on this server yet"
      emptyLine="The players with the most time here show up on this board."
      rows={pt.ok && !pt.empty ? pt.rows : []}
    />
    {#each data.boards as b (b.id)}
      <BarList title={b.label} href={b.href} sub="server · top 5" faces unit={b.unit} asOf={b.asOf} stale={b.stale} emptyTitle="Nobody has done this yet" rows={b.rows} />
    {/each}
  </div>
{/if}

{#if data.live.length || data.busiest.length}
  <div class="fx-grid">
    {#if data.live.length}
      <Window path="~/servers/{data.id}" args="--minis">
        <WindowHead title="Running now" level={3} asof="public mini-servers on {data.name}" />
        <div class="list">
          {#each data.live as m (m.id)}
            <div class="li"><span class="mk">»</span><span class="grow">{m.name}</span><span class="meta">{m.count} {m.count === 1 ? "player" : "players"}</span></div>
            {#if m.players.length}
              <div class="fx-faces">
                {#each m.players as p (p.uuid)}<a href="/players/{encodeURIComponent(p.name)}" title={p.name}><Face uuid={p.uuid} name={p.name} size="sm" /><span>{p.name}</span></a>{/each}
              </div>
            {/if}
          {/each}
        </div>
      </Window>
    {/if}
    {#if data.busiest.length}
      <BarList title="Busiest mini-servers" sub="peak players this week" since={data.since} rows={data.busiest} emptyTitle="No mini-servers yet" />
    {/if}
  </div>
{/if}

<div class="fx-grid">
  <MilestoneFeed result={data.milestones} title="Latest milestones here" href="/milestones?scope={encodeURIComponent(data.scope)}" />
  <AdvancementFeed result={data.advancements} title="Advancements completed here first" href="/advancements?scope={encodeURIComponent(data.scope)}" showServer={false} />
</div>
