<script lang="ts">
  // Every chart (W3) in every state the pages will put it in: data, a highlight, a shadow series,
  // long series, odd units, one point, nothing. The numbers here are sample data for the gallery
  // only; no public page uses them.
  import { page } from "$app/state";
  import { BarList, ColumnChart, Heatmap, LineChart, StatTile, UptimeStrip, ViewSwitch, viewParam } from "#lib/charts/index.ts";
  const view = $derived(viewParam(page.url));
  const uuid = "346d7245-336d-40b2-a26d-6f1f316d6d8c";
  const now = Date.UTC(2026, 10, 4, 17, 0);
  const H = 3_600_000;
  const D = 86_400_000;
  const since = now - 20 * D;
  // a day of minute samples: a daily wave with a little noise, deterministic
  const wave = (i: number, n: number, amp: number) => Math.max(0, Math.round(amp * (0.55 + 0.45 * Math.sin(((i / n) * 2 - 0.6) * Math.PI)) + 2 * Math.sin(i * 1.7)));
  const day = Array.from({ length: 24 * 6 }, (_, i) => ({ t: now - D + i * 10 * 60_000, v: wave(i, 144, 14) }));
  const waiting = day.map((p, i) => ({ t: p.t, v: i % 37 < 4 ? 3 : i % 53 < 2 ? 1 : 0 }));
  const week = Array.from({ length: 7 * 24 }, (_, i) => ({ t: now - 7 * D + i * H, v: wave(i % 24, 24, 11 + (i % 7)) }));
  const joins = [3, 5, 4, 8, 12, 9, 7, 11, 14, 10, 6, 4].map((v, i) => ({ key: `w${i}`, label: `W${40 + i}`, v }));
  const days = Array.from({ length: 90 }, (_, i) => ({ t: now - (89 - i) * D, v: wave(i, 30, 9) }));
  const servers = [
    { key: "survival", label: "Survival", v: 148_000_000, display: "1d 17h 7m", href: "#s" },
    { key: "creative", label: "Creative", v: 61_000_000, display: "16h 56m", href: "#c" },
    { key: "lobby", label: "Lobby", v: 9_000_000, display: "2h 30m", href: "#l" }
  ];
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const heat = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, r) => ({
    label,
    // Sunday's row stops at 17:00: cells still to come are left out (undefined), drawn as a hairline
    cells: hours.slice(0, r === 6 ? 17 : 24).map((_, c) => (r === 0 && c < 3 ? null : wave(c, 24, 10 + r)))
  }));
  const samples = Array.from({ length: 7 * 24 * 4 }, (_, i) => {
    const t = now - 7 * D + i * 15 * 60_000;
    const down = (i > 200 && i < 215) || (i > 500 && i < 503);
    const gap = i > 320 && i < 340;
    return gap ? null : { t, online: down ? 0 : wave(i % 96, 96, 12), waiting: down ? 4 : 0, linked: !down };
  }).filter((s): s is NonNullable<typeof s> => s !== null);
  const board = [
    { rank: 1, key: "a", uuid, label: "Pebblewick", v: 148_000_000, display: "1d 17h 7m", href: "#a" },
    { rank: 2, key: "b", uuid, label: "Sealily", v: 90_000_000, display: "1d 1h 0m", href: "#b" },
    { rank: 3, key: "c", uuid, label: "Bream", v: 40_000_000, display: "11h 6m", href: "#c" },
    { rank: 4, key: "d", uuid, label: "A_very_long_player_name_here", v: 22_000_000, display: "6h 6m", href: "#d" },
    { rank: 5, key: "e", uuid, label: "Minnow", v: 3_000_000, display: "50m", href: "#e" }
  ];
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">Design system</span>
    <h1 class="t-hero">Charts</h1>
    <p class="fp-lede t-body-lg">One hue, columns at most 24 px, 2 px lines, a readout in the header that follows the pointer and the arrow keys, and a table twin behind the switch. Sample data, for this page only.</p>
  </header>

  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-2">Tiles</h2><ViewSwitch url={page.url} {view} /></div>
    <div class="fp-tiles">
      <StatTile label="Online now" value="8" note="as of 17:00 UTC" spark={day.slice(-60)} sparkLabel="Online over the last ten hours" />
      <StatTile label="Blocks mined" value="1.2M" unit="blocks" note="since 15 Oct 2026" spark={days.slice(-30)} />
      <StatTile label="Players seen" value="37" note="one point" spark={[{ t: now, v: 37 }]} />
      <StatTile label="Network playtime" value="4d 2h 9m" />
    </div>
  </section>

  <section class="fp-section">
    <h2 class="t-title-2">Columns</h2>
    <div class="fp-panels">
      <ColumnChart title="Joins per week" sub="network · players" {view} points={joins} highlight="w8" />
      <ColumnChart title="Playtime by server" sub="Pebblewick" {view} unit="ms" points={servers} highlight="creative" />
      <ColumnChart title="Online per day" sub="network · 90 days · mean" {view} points={days} since={since} asOf={now} />
      <ColumnChart title="Joins per week" sub="network" {view} points={[{ key: "w1", label: "W45", v: 1 }]} emptyTitle="Not enough weeks yet" emptyLine="Joins show once two weeks have passed." />
    </div>
  </section>

  <section class="fp-section">
    <h2 class="t-title-2">Lines</h2>
    <div class="fp-panels">
      <LineChart title="Online over the day" sub="network · players" {view} points={day} since={since} asOf={now} shadow={{ label: "waiting", points: waiting }} />
      <LineChart title="Online over the week" sub="survival · players" {view} points={week} since={since} asOf={now - H} stale />
      <LineChart title="Distance walked" sub="network · total" {view} unit="distance_cm" zero={false} points={days.map((p, i) => ({ t: p.t, v: 2_000_000_000 + i * 15_000_000 + p.v * 100_000 }))} since={since} />
      <LineChart title="Online over the week" sub="creative" since={null} points={[]} emptyTitle="No history yet" emptyLine="Online counts are recorded every minute once the site is live." />
    </div>
  </section>

  <section class="fp-section">
    <h2 class="t-title-2">Heat and uptime</h2>
    <div class="fp-panels">
      <Heatmap title="Busiest hours" sub="network · mean online · UTC" {view} rows={heat} columns={hours} since={since} cellLabel={(r, c) => `${r} ${c}:00`} />
      <Heatmap title="Busiest hours" sub="lobby" rows={[{ label: "Mon", cells: [null, null, null] }]} columns={["00", "06", "12"]} since={since} emptyTitle="No history yet" />
      <UptimeStrip title="Survival · last 7 days" sub="15 min buckets" {view} {samples} bucketMs={15 * 60_000} since={since} asOf={now} />
      <UptimeStrip title="Creative · last 7 days" samples={[]} since={null} emptyTitle="No history yet" />
    </div>
  </section>

  <section class="fp-section">
    <h2 class="t-title-2">Bars</h2>
    <div class="fp-panels">
      <BarList title="Playtime" sub="network · top 5" {view} faces unit="ms" rows={board} highlight="c" asOf={now} />
      <BarList title="Stone mined" sub="survival" {view} rows={[]} emptyTitle="Nobody has done this yet" emptyLine="This board fills in when someone mines stone." />
    </div>
  </section>
</div>
