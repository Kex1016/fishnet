<script lang="ts">
  import { page } from "$app/state";
  import { Clock } from "@lucide/svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import { ColumnChart, Heatmap, LineChart, StatTile, ViewSwitch, viewParam } from "#lib/charts/index.ts";
  import { durationMs } from "#lib/format/stat-display.ts";
  import { dateTime, day } from "#lib/format/dates.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const view = $derived(viewParam(page.url));
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // weekday 0 is taken as Monday (ISO); an open contract question, the page says UTC either way
  const heat = $derived.by(() => {
    if (!data.heat?.ok) return null;
    const rows = DAYS.map((label) => ({ label, cells: Array.from({ length: 24 }, () => null as number | null) }));
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

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Activity</h1>
    <p class="fp-lede">When the network is busy: players online, time played per day and the busiest hours of the week. Charts count in UTC days and hours.</p>
  </header>
  <div class="ax-bar">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
    <ViewSwitch url={page.url} {view} />
  </div>

  {#if data.mini}
    <p class="t-small t-muted">Activity is kept per server and for the whole network, not per mini-server. Pick a server or the network above.</p>
  {:else if !online && !data.playtime?.ok}
    <Notice kind="warning">Activity could not be loaded right now.</Notice>
  {:else}
    {#if online?.peak && online.peak.count > 0}
      <div class="fp-tiles ax-tiles">
        <StatTile label="Most players online at once" value={String(online.peak.count)} note={dateTime(online.peak.at)} />
        {#if playPts.length}
          {@const s = playPts}
          <StatTile label="Played in the last 30 days" value={durationMs(s.reduce((a, x) => a + x.ms, 0))} note="all players together" />
          <StatTile label="Most players in a day" value={String(Math.max(...s.map((x) => x.players)))} note="last 30 days" />
        {/if}
      </div>
    {/if}
    <div class="ax-grid">
      <div class="ax-wide">
        {#if online}
          <div class="ax-range">
            <nav class="fp-seg" aria-label="Range">
              <a href={withParams(page.url, { range: null })} aria-current={data.range === "30d" ? "page" : undefined}>30 days</a>
              <a href={withParams(page.url, { range: "2d" })} aria-current={data.range === "2d" ? "page" : undefined}>48 hours</a>
            </nav>
          </div>
          <LineChart
            title="Players online"
            sub={data.range === "2d" ? "most at once each hour, UTC" : "most at once each day, UTC"}
            points={onlinePts.map((p) => ({ t: p.start, v: p.max }))}
            shadow={{ label: "average", points: onlinePts.map((p) => ({ t: p.start, v: p.avg })) }}
            unit="count"
            asOf={data.online?.ok ? data.online.asOf : undefined}
            stale={data.online?.ok ? data.online.stale : false}
            {view}
            emptyTitle="Nobody online yet"
            emptyLine="The graph fills in as players join."
          />
        {/if}
      </div>
      {#if data.playtime?.ok}
        <ColumnChart
          title="Time played per day"
          sub="all players together, UTC days"
          points={playPts.map((p) => ({ t: p.start, v: p.ms }))}
          unit="ms"
          format={fmtH}
          {view}
          emptyTitle="Nobody has played yet"
        />
      {/if}
      {#if heat}
        <Heatmap title="Busiest hours" sub="time played by weekday and hour, UTC, last 90 days" rows={heatRows} columns={hours} unit="ms" format={fmtH} {view} emptyTitle="Nobody has played yet" />
      {/if}
      {#if data.milestones?.ok}
        <section class="fp-card ax-firsts">
          <h2 class="t-title-4">First to</h2>
          {#if data.firstTo.length === 0}
            <p class="t-small t-muted">Nobody has played an hour yet.</p>
          {:else}
            <ol class="ax-list">
              {#each data.firstTo as m (m.threshold_ms)}
                <li>
                  <span class="ax-th"><Clock class="fp-ico fp-ico--sm" strokeWidth={1.4} aria-hidden="true" />{m.display}</span>
                  <Face uuid={m.uuid} name={m.name} size="sm" />
                  <a href="/players/{encodeURIComponent(m.name)}">{m.name}</a>
                  <span class="t-caption ax-when">{m.reached_at === null ? "before tracking began" : day(m.reached_at)}</span>
                </li>
              {/each}
            </ol>
          {/if}
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ax-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .ax-tiles {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
  .ax-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
    gap: var(--space-4);
  }
  .ax-wide {
    grid-column: 1 / -1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .ax-range {
    display: flex;
    justify-content: flex-end;
  }
  .ax-firsts {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .ax-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .ax-list li {
    display: grid;
    grid-template-columns: 80px 24px minmax(0, 1fr) auto;
    gap: var(--space-3);
    align-items: center;
  }
  .ax-th {
    display: inline-flex;
    gap: var(--space-1);
    align-items: center;
    font: 500 13px/20px var(--font-mono);
  }
  .ax-when {
    color: var(--faint);
  }
</style>
