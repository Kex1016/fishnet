<script lang="ts">
  import { page } from "$app/state";
  import { EmptyState, Feed, FeedRow, Notice, PageHead, ScopeSwitch, Segmented, Window, WindowHead } from "#lib/design/index.ts";
  import { ColumnChart, Heatmap, LineChart, StatTile } from "#lib/charts/index.ts";
  import { durationMs } from "#lib/format/stat-display.ts";
  import { WEEKDAYS, dateTime, day } from "#lib/format/dates.ts";
  import { playerHref, playerRowLabel } from "#lib/players/names.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  // weekday 0 is taken as Monday (ISO); an open contract question, the page says UTC either way
  const heat = $derived.by(() => {
    if (!data.heat?.ok) return null;
    const rows = WEEKDAYS.map((label) => ({ label, cells: Array.from({ length: 24 }, () => null as number | null) }));
    for (const [wd, h, ms] of data.heat.data.cells) if (wd >= 0 && wd < 7 && h >= 0 && h < 24) rows[wd].cells[h] = ms;
    return rows;
  });
  const hours = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
  const online = $derived(data.online?.ok ? data.online.data : null);
  const fmtH = (v: number) => durationMs(v);
  // a series of zeros is "nobody yet": the charts get no points and show their empty state
  const onlinePts = $derived(online && online.series.some((p) => p.max > 0) ? online.series : []);
  const playPts = $derived(data.playtime?.ok && data.playtime.data.series.some((p) => p.ms > 0) ? data.playtime.data.series : []);
  const heatRows = $derived(heat && heat.some((r) => r.cells.some((c) => (c ?? 0) > 0)) ? heat : []);
</script>

<PageHead cmd="cat" args="activity" title="activity" lede="When the network is busy: players online, time played per day and the busiest hours of the week. Charts count in UTC days and hours.">
  <div class="fx-filters">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
    {#if online && !data.mini}
      <Segmented
        label="Range"
        options={[
          { href: withParams(page.url, { range: null }), label: "30 days", current: data.range === "30d" },
          { href: withParams(page.url, { range: "2d" }), label: "48 hours", current: data.range === "2d" }
        ]}
      />
    {/if}
  </div>
</PageHead>

{#if data.mini}
  <Notice kind="info">Activity is kept per server and for the whole network, not per mini-server. Pick a server or the network above.</Notice>
{:else if !online && !data.playtime?.ok}
  <Notice kind="warning">Activity could not be loaded right now.</Notice>
{:else}
  {#if online?.peak && online.peak.count > 0}
    <div class="stat-panel fx-tiles">
      <StatTile label="Most players online at once" value={String(online.peak.count)} note={dateTime(online.peak.at)} />
      {#if playPts.length}
        <StatTile label="Played in the last 30 days" value={durationMs(playPts.reduce((a, x) => a + x.ms, 0))} note="all players together" />
        <StatTile label="Most players in a day" value={String(Math.max(...playPts.map((x) => x.players)))} note="last 30 days" />
      {/if}
    </div>
  {/if}
  {#if online}
    <LineChart
      title="Players online"
      sub={data.range === "2d" ? "most at once each hour, UTC" : "most at once each day, UTC"}
      points={onlinePts.map((p) => ({ t: p.start, v: p.max }))}
      shadow={{ label: "average", points: onlinePts.map((p) => ({ t: p.start, v: p.avg })) }}
      unit="count"
      asOf={data.online?.ok ? data.online.asOf : undefined}
      stale={data.online?.ok ? data.online.stale : false}
      emptyTitle="Nobody online yet"
      emptyLine="The graph fills in as players join."
    />
  {/if}
  <div class="fx-grid">
    {#if data.playtime?.ok}
      <ColumnChart
        title="Time played per day"
        sub="all players together, UTC days"
        points={playPts.map((p) => ({ t: p.start, v: p.ms }))}
        unit="ms"
        format={fmtH}
        emptyTitle="Nobody has played yet"
      />
    {/if}
    {#if heat}
      <Heatmap title="Busiest hours" sub="time played by weekday and hour, UTC, last 90 days" rows={heatRows} columns={hours} unit="ms" format={fmtH} emptyTitle="Nobody has played yet" />
    {/if}
  </div>
  {#if data.milestones?.ok}
    <Window path="~/activity" args="--first-to">
      <WindowHead title="First to" asof="the first player to each hour mark" />
      {#if data.firstTo.length === 0}
        <EmptyState title="Nobody has played an hour yet" />
      {:else}
        <Feed label="First to each play time">
          {#each data.firstTo as m (m.threshold_ms)}
            <FeedRow uuid={m.uuid} href={playerHref(m)} when={m.reached_at === null ? "" : day(m.reached_at)}>
              {m.display}
              {#snippet sub()}<span>{playerRowLabel(m)}</span>{m.reached_at === null ? " · reached before tracking began" : ""}{/snippet}
            </FeedRow>
          {/each}
        </Feed>
      {/if}
    </Window>
  {/if}
{/if}
