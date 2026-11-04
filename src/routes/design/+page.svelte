<script lang="ts">
  import { page } from "$app/state";
  import { ChevronDown, Search } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import Card from "#lib/design/Card.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { BarList, ColumnChart, Heatmap, LineChart, StatTile, UptimeStrip, ViewSwitch, viewParam } from "#lib/charts/index.ts";
  import { Segments } from "#lib/players/index.ts";
  const view = $derived(viewParam(page.url));
  const uuid = "346d7245-336d-40b2-a26d-6f1f316d6d8c";
  const now = Date.UTC(2026, 10, 4, 17, 0);
  const pts = Array.from({ length: 12 }, (_, i) => ({ t: now - (11 - i) * 3_600_000, v: [3, 5, 4, 8, 12, 9, 7, 11, 14, 10, 6, 4][i] }));
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">Design system</span>
    <h1 class="t-hero">Fishplex look</h1>
    <p class="fp-lede t-body-lg">reki's layout with the Fishplex skin: warm greys, one sea-blue accent, compact corners, quick motion. Dark first, light works.</p>
  </header>

  <section class="fp-section">
    <h2 class="t-title-2">Type</h2>
    <div class="fp-panel" style="display: flex; flex-direction: column; gap: var(--space-2)">
      <div class="t-display">Display · 魚の群れ</div>
      <div class="t-title-1">Title 1</div><div class="t-title-2">Title 2</div><div class="t-title-3">Title 3</div><div class="t-title-4">Title 4</div>
      <p class="t-body">Body text for notes and descriptions, in Zen Kaku Gothic New. Sentence case, no exclamation marks.</p>
      <p class="t-small t-muted">Small secondary line in muted.</p>
      <div><span class="t-kicker">Kicker</span> <span class="t-num">1 234 567</span> <span class="t-caption">4 Nov 2026, 17:44 UTC</span> <span class="t-score t-acc">9/13</span></div>
      <div class="t-stat">12.5 ♥</div>
    </div>
  </section>

  <section class="fp-section">
    <h2 class="t-title-2">Controls</h2>
    <div class="fp-panel fp-filters">
      <button class="fp-btn fp-btn--primary">Add picks</button>
      <button class="fp-btn">Open board</button>
      <button class="fp-btn fp-btn--quiet">Later</button>
      <a class="fp-chip" href="#x">Chip</a><a class="fp-chip" href="#x" aria-current="true">Chosen chip</a>
      <span class="fp-tag">tag</span><span class="fp-tag fp-tag--acc">accent</span><span class="fp-tag fp-tag--success">linked</span><span class="fp-tag fp-tag--warning">waiting</span><span class="fp-tag fp-tag--error">down</span>
      <label class="fp-field fp-search"><Search class="fp-ico fp-ico--sm" strokeWidth={1.4} /><input placeholder="Find a player" /></label>
      <span class="fp-select"><select aria-label="Type"><option>Mined</option><option>Killed</option></select><ChevronDown class="fp-ico fp-ico--sm" strokeWidth={1.4} /></span>
      <ScopeSwitch url={page.url} scope="network" servers={[{ id: "survival", display_name: "Survival" }, { id: "creative", display_name: "Creative" }]} />
      <ViewSwitch url={page.url} {view} />
      <span class="fp-spin" role="status" aria-label="Working"></span> <span class="t-small t-muted">Fetching the board</span>
    </div>
  </section>

  <section class="fp-section">
    <h2 class="t-title-2">Tiles</h2>
    <div class="fp-tiles">
      <StatTile label="Online now" value="8" note="as of 17:44 UTC" />
      <StatTile label="Network playtime" value="4d 2h 9m" note="since 15 Oct 2026" spark={pts} />
      <StatTile label="Blocks mined" value="1.2M" unit="blocks" href="#x" />
      <StatTile label="Players seen" value="37" />
    </div>
  </section>

  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-2">Charts</h2><ViewSwitch url={page.url} {view} /></div>
    <div class="fp-panels">
      <ColumnChart title="Joins per week" sub="network" {view} points={pts.map((p, i) => ({ key: String(i), label: `W${i + 1}`, v: p.v }))} />
      <LineChart title="Online over the day" sub="network · players" {view} points={pts} since={now - 86_400_000 * 20} />
      <LineChart title="Online over the week" sub="network" since={null} points={[]} emptyTitle="No history yet" emptyLine="Online counts are recorded every minute once the site is live." />
      <Heatmap title="Busiest hours" sub="mean online" {view} rows={[{ label: "Mon", cells: [1, 2, null, 4] }, { label: "Tue", cells: [0, 3, 5, 2] }]} columns={["00", "06", "12", "18"]} />
      <BarList title="Playtime" sub="network · top 5" {view} faces unit="ms" rows={[{ rank: 1, key: "a", uuid, label: "Pebblewick", v: 148_000_000, display: "1d 17h 7m" }, { rank: 2, key: "b", uuid, label: "Sealily", v: 90_000_000, display: "1d 1h 0m" }, { rank: 3, key: "c", uuid, label: "Bream", v: 40_000_000, display: "11h 6m" }]} />
      <UptimeStrip title="Survival · last 7 days" samples={[]} since={null} emptyTitle="No history yet" />
    </div>
  </section>

  <section class="fp-section">
    <h2 class="t-title-2">Rows, states and words</h2>
    <div class="fp-panels">
      <Card title="Players" sub="3 online">
        {#snippet readout()}<b>3</b><span>online</span>{/snippet}
        <div class="fp-rows">
          <div class="fp-row" style="grid-template-columns: minmax(0,1fr) auto"><PlayerName {uuid} name="Pebblewick" online /><span class="fp-row__value">1d 17h 7m</span></div>
          <div class="fp-row" style="grid-template-columns: 36px minmax(0,1fr) auto"><Slot icon={null} kind="block" name="Stone" /><span class="fp-row__name">Stone <span class="fp-row__sub">minecraft:mined</span></span><span class="fp-row__value">119 921</span></div>
          <div class="fp-row" style="grid-template-columns: 36px minmax(0,1fr) auto"><Slot icon={null} kind="entity" name="Iron Golem" /><span class="fp-row__name">Iron Golem</span><span class="fp-row__value">6</span></div>
        </div>
        {#snippet foot()}<span>Recording since 15 Oct 2026</span><AsOf at={now} />{/snippet}
      </Card>
      <div style="display: flex; flex-direction: column; gap: var(--space-3)">
        <Notice kind="info"><b>Milestones are off on this proxy.</b> They appear once it is updated.</Notice>
        <Notice kind="warning"><b>cakeutils could not be reached.</b> Showing the last good data, as of 17:40 UTC.</Notice>
        <Notice kind="error"><b>The token was refused.</b> Check its scopes.</Notice>
        <Notice kind="success"><b>Linked.</b> Survival is sending stats.</Notice>
        <EmptyState title="Nobody has done this yet" line="This board fills in when someone records the stat." since={now - 86_400_000 * 20} />
        <div class="t-title-3"><Segments segments={[{ text: "[Admin] ", color: "red", bold: true }]} />Pebblewick<Segments segments={[{ text: " ♪", color: "light_purple", italic: true }]} /></div>
        <div class="fp-faces"><Face {uuid} name="a" size="sm" /><Face {uuid} name="b" /><Face {uuid} name="c" size="lg" /></div>
        <Pager url={page.url} total={137} limit={50} offset={50} what="players" />
      </div>
    </div>
  </section>
</div>
