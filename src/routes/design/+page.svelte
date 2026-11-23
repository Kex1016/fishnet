<script lang="ts">
  // Every shared part once, in the order of docs/HAIIRO.md. Sample data: this page is dev and mock only.
  import { page } from "$app/state";
  import { AsOf, Catalogue, EmptyState, Face, Feed, FeedRow, KeyValueSheet, KV, Ladder, Notice, PageHead, Pager, PlayerName, Progress, PromptLine, RankList, ScopeSwitch, Segmented, Slot, Window, WindowHead } from "#lib/design/index.ts";
  import { withParams } from "#lib/url.ts";
  const uuid = "346d7245-336d-40b2-a26d-6f1f316d6d8c";
  const now = Date.UTC(2026, 10, 23, 21, 31);
  const colours = ["base", "surface", "overlay", "muted", "subtle", "text", "love", "gold", "rose", "pine", "foam", "iris", "highlight-low", "highlight-med", "highlight-high"];
  const cols = [3, 5, 4, 8, 12, 9, 7, 11, 14, 10, 6, 4, 9, 13, 8, 5, 7, 12, 16, 11, 9, 6, 8, 10];
  const heat = Array.from({ length: 3 }, (_, d) => Array.from({ length: 24 }, (_, h) => (d * 7 + h * 5) % 5));
  const rows = [
    { key: "a", rank: 1, uuid, label: "Pebblewick", share: 1, value: "187h 12m", href: "/design" },
    { key: "b", rank: 2, uuid, label: "Saltmarsh", share: 0.74, value: "139h 2m", href: "/design", current: true },
    { key: "c", rank: 3, uuid, label: "Finnegan_B", share: 0.5, value: "93h 40m", href: "/design" },
    { key: "d", rank: 4, uuid, label: "koi_pond", share: 0.31, value: "58h 5m", sub: "online", href: "/design" }
  ];
  const view = $derived(page.url.searchParams.get("view") ?? "all");
</script>

<PageHead cmd="cat" args="haiiro.md" title="design" lede="Every shared part of the look, once. The page is for the people who build the site: the numbers on it are samples." note="Tokens: src/lib/design/tokens.css. Classes: base.css and components.css. The contract: docs/HAIIRO.md.">
  <Segmented label="View" options={[{ href: withParams(page.url, { view: null }), label: "all", current: view === "all" }, { href: withParams(page.url, { view: "realm" }), label: "one soul realm", current: view === "realm" }, { label: "no link" }]} />
  <div class="fx-head row"><a class="c6" href="/design/charts">charts</a><a class="c6" href="/design/map">map</a><a class="c1" href="/">home</a></div>
</PageHead>

<div class={view === "realm" ? "realm fx-stack" : "fx-stack"} style="gap: 48px; background: none">
  <Window path="~/design/colour">
    <WindowHead title="Colour" asof="Rosé Pine main; Gruvbox dark inside .realm" />
    <div class="dz-sw">
      {#each colours as c (c)}<div><i style="background: var(--color-{c})"></i><span>{c}</span></div>{/each}
    </div>
    <p class="cap">Ink classes: <span class="c1">c1 muted</span> <span class="c2">c2 love</span> <span class="c3">c3 gold</span> <span class="c4">c4 rose</span> <span class="c5">c5 pine</span> <span class="c6">c6 foam</span> <span class="c7">c7 iris</span>. Inverse links: <a class="c2" href="/design">c2</a> <a class="c3" href="/design">c3</a> <a class="c4" href="/design">c4</a> <a class="c5" href="/design">c5</a> <a class="c6" href="/design">c6</a> <a class="c7" href="/design">c7</a> <a class="c1" href="/design">c1</a></p>
  </Window>

  <Window path="~/design/type">
    <WindowHead title="Type" asof="IBM VGA 8x16, Jacquard 24 for the page title and the drop cap, Unifont behind both" />
    <div class="fx-stack">
      <PromptLine cmd="cat" args="network.md" />
      <p>Body text is IBM VGA at 16px. <b>Bold is the 2x face.</b> Characters it does not have come from Unifont: ★ – … ‹ › ő 魚.</p>
      <p class="c4">Narration is rose.</p>
      <p><span class="lab">a label</span> <span class="num">1,234,567</span> <span class="cap">a caption</span> <span class="kbd">Esc</span> <span class="chip">chip</span> <span class="chip on">chip on</span> <span class="badge">badge</span></p>
      <div class="fx-read"><span class="big num">23</span><span class="cap">a big readout at 32px</span></div>
    </div>
  </Window>

  <div class="fx-grid">
    <Window path="~/design/windows" args="--tone" tone="gold">
      <WindowHead title="Gold" level={3} asof="needs you, the living" />
      <p>The frame colour carries meaning.</p>
    </Window>
    <Window path="~/design/windows" tone="love">
      <WindowHead title="Love" level={3} asof="critical, failed, the dead" />
      <p>Never colour alone: the words say it too.</p>
    </Window>
    <Window path="~/design/windows" tone="foam">
      <WindowHead title="Foam" level={3} asof="done" />
      <p>A window with a foot.</p>
      {#snippet foot()}<span>foot line</span><AsOf at={now} />{/snippet}
    </Window>
    <Window path="~/design/windows" tone="off">
      <WindowHead title="Off" level={3} asof="not linked" />
      <EmptyState title="Not linked" line="Events shows up here as soon as it connects to the network." />
    </Window>
  </div>

  <Window path="~/design/controls">
    <WindowHead title="Controls" asof="square, stepwise, no easing" />
    <div class="fx-stack">
      <div class="fx-filters">
        <ScopeSwitch url={page.url} scope="network" servers={[{ id: "survival", display_name: "Survival" }, { id: "creative", display_name: "Creative" }]} />
        <label class="fx-search"><span class="c4">»</span><input type="search" placeholder="find a player" aria-label="Find a player" /></label>
      </div>
      <p><button class="ink c3" type="button">the one action</button> <button class="ink" type="button">ink</button> <button class="ink c5" type="button">pine</button> <button class="ink flat" type="button">flat</button> <button class="ink" type="button" disabled>disabled</button></p>
      <div class="list" style="max-width: 320px">
        <a class="li" href="/design"><span class="mk">»</span><span class="grow">A list row</span><span class="meta">12</span></a>
        <a class="li" href="/design" aria-current="page"><span class="mk">»</span><span class="grow">The current row</span><span class="meta">312</span></a>
      </div>
      <Pager url={page.url} total={148} limit={15} offset={15} what="players" />
    </div>
  </Window>

  <Window path="~/design/states">
    <WindowHead title="States" asof="three answers for not happened yet" />
    <div class="fx-stack">
      <Notice kind="warning"><b>cakeutils could not be reached.</b> Showing the last good data.</Notice>
      <Notice kind="error">The board could not be loaded.</Notice>
      <Notice kind="info">Charts bucketed by UTC day keep UTC labels.</Notice>
      <EmptyState title="Nobody has done this yet" line="The first player to do it shows up here." since={now - 19 * 86_400_000} />
      <p><AsOf at={now} /> · <AsOf at={now - 3_600_000} stale /></p>
    </div>
  </Window>

  <Window path="~/design/numbers">
    <WindowHead title="Numbers"><span class="num">23</span> online</WindowHead>
    <div class="stat-panel fx-tiles">
      <div><span class="kv_label">Online now</span><span class="kv_value num">23</span><span class="note">2 waiting</span><div class="spark">{#each cols as c, i (i)}<i style="height: {c + 4}px"></i>{/each}</div></div>
      <a href="/design"><span class="kv_label">Survival</span><span class="kv_value num">11<small>online</small></span><span class="note">a tile can be a link</span></a>
      <div class="off"><span class="kv_label">Events</span><span class="kv_value num">0</span><span class="note">not linked</span></div>
    </div>
    <div class="fx-grid" style="margin-top: 24px">
      <div>
        <div class="fx-read"><span class="big num">14</span><span class="cap">peak · 18:00 UTC</span></div>
        <div class="fx-cols">{#each cols as c, i (i)}<i class={i === cols.length - 1 ? "now" : undefined} style="height: {c * 6}%"></i>{/each}</div>
        <div class="fx-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      </div>
      <div>
        <div class="fx-heat">
          {#each heat as day, d (d)}<span>{["Mon", "Tue", "Wed"][d]}</span>{#each day as h, i (i)}<i class={h ? `h${h}` : undefined}></i>{/each}{/each}
        </div>
        <div class="fx-legend"><span>less</span><i></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i><span>more</span></div>
        <div style="margin-top: 16px">
          <Progress label="Network" value="9,184 h" share={1} />
          <Progress label="Survival" value="6,020 h" share={0.66} ink="c6" />
          <Progress label="skyblock" value="1,204 h" share={0.13} ink="c7" indent={1} />
        </div>
      </div>
    </div>
  </Window>

  <div class="fx-grid wide">
    <Window path="~/design/rank">
      <WindowHead title="Ranked rows" asof="share of the leader, inside one scope" />
      <RankList {rows} label="Sample board" />
    </Window>
    <Window path="~/design/rank" args="--compact">
      <WindowHead title="Compact" level={3} />
      <RankList rows={rows.map((r) => ({ ...r, uuid: undefined, sub: undefined }))} compact />
    </Window>
  </div>

  <div class="fx-grid">
    <Window path="~/design/feed">
      <WindowHead title="Feed" />
      <Feed label="Sample feed">
        <FeedRow rarity={6} when="23 Nov 2026" href="/design"><span class="c6">Pebblewick</span> mined 1,000,000 blocks{#snippet sub()}network · stone{/snippet}</FeedRow>
        <FeedRow rarity={4} when="19 Nov 2026">Play 100 hours{#snippet sub()}<span class="c6">Saltmarsh</span> · first in the network{/snippet}</FeedRow>
        <FeedRow {uuid}>Join the network{#snippet sub()}<span class="c6">koi_pond</span> · reached before tracking began{/snippet}</FeedRow>
      </Feed>
    </Window>
    <Window path="~/design/people">
      <WindowHead title="People and pictures" />
      <div class="fx-stack">
        <div class="fx-soul">
          <Face {uuid} name="Pebblewick" size="lg" />
          <div class="fx-stack">
            <p><Face {uuid} size="sm" /> <Face {uuid} /> <Face {uuid} tint="iris" /> sm 20, md 32, lg 128</p>
            <p><PlayerName {uuid} name="Pebblewick" online /></p>
            <p><Slot icon={null} name="No picture" /> <Slot icon={null} rarity={6} size="lg" /> <Slot icon={null} rarity={5} /> <Slot icon={null} rarity={4} /> <Slot icon={null} rarity={3} /> <Slot icon={null} rarity={2} /></p>
          </div>
        </div>
        <div class="fx-faces"><a href="/design"><Face {uuid} /><span>Pebblewick</span></a><a href="/design"><Face {uuid} tint="pine" /><span>Driftwood_Dan</span></a></div>
        <Ladder label="Sample ladder" steps={[{ label: "100", state: "reached", title: "100 blocks, reached 4 Nov 2026" }, { label: "1k", state: "reached", title: "1,000 blocks, reached 12 Nov 2026" }, { label: "10k", state: "next", title: "10,000 blocks, next" }, { label: "100k", state: "locked", title: "100,000 blocks, not reached yet" }, { label: "3", state: "dead", title: "Turn 3, dead" }]} />
      </div>
    </Window>
  </div>

  <div class="fx-grid">
    <Window path="~/design/sheet">
      <WindowHead title="Sheet" level={3} />
      <KeyValueSheet rows={[{ label: "first seen", value: "1 Nov 2026" }, { label: "playtime", value: "187h 12m", num: true }, { label: "second chance", value: "unused", ink: "c3" }]}>
        <KV label="on"><a class="c6" href="/design">Survival</a></KV>
      </KeyValueSheet>
    </Window>
    <Window path="~/design/table">
      <WindowHead title="Table" level={3} />
      <div class="fx-scroll">
        <table class="fx-table">
          <thead><tr><th>Player</th><th class="r">Playtime</th><th class="r">Last seen</th></tr></thead>
          <tbody>
            <tr><td>Pebblewick</td><td class="r">187h 12m</td><td class="r">23 Nov 2026</td></tr>
            <tr aria-current="true"><td>Saltmarsh</td><td class="r">139h 2m</td><td class="r">22 Nov 2026</td></tr>
          </tbody>
        </table>
      </div>
    </Window>
  </div>

  <Window path="~/design/catalogue">
    <WindowHead title="Catalogue" level={3} />
    <Catalogue pic label="Sample catalogue" items={[{ href: "/design?c=1", label: "Stone", meta: "12 boards" }, { href: "/design?c=2", label: "Cobblestone", meta: "9 boards", current: true }, { href: "/design?c=3", label: "A very long subject name that has to wrap", meta: "1 board" }]} />
  </Window>
</div>

<style>
  .dz-sw { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin-bottom: 12px; }
  .dz-sw > div { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ink-muted); }
  .dz-sw i { display: block; height: 40px; border: 1px solid var(--ink-hairline); }
</style>
