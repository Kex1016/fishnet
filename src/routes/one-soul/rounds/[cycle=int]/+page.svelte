<script lang="ts">
  import { page } from "$app/state";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Ladder from "#lib/design/Ladder.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import RankList from "#lib/design/RankList.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { BarList } from "#lib/charts/index.ts";
  import { AdvancementFeed, MilestoneFeed } from "#lib/milestones/index.ts";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import Outcome from "#lib/onesoul/Outcome.svelte";
  import Tiles from "#lib/onesoul/Tiles.svelte";
  import type { Tile } from "#lib/onesoul/Tiles.svelte";
  import { life, outcomeLabel, titleId } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { barRows } from "#lib/onesoul/boards.ts";
  import { day } from "#lib/format/dates.ts";
  import RoundMap from "#lib/map/layers/RoundMap.svelte";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const s = $derived(data.summary);
  const souls = $derived(data.souls.rows);
  const graves = $derived(data.graves.rows);
  const over = $derived(!!s.ended_at);

  const when = $derived(s.started_at ? `${day(s.started_at)}${s.ended_at ? ` to ${day(s.ended_at)}` : ", still running"}` : "Sign-ups, world not opened yet");
  const tiles = $derived.by((): Tile[] => {
    const out: Tile[] = [
      { label: "souls", value: String(s.souls) },
      { label: "time survived", value: life(s.total_survival_ms) }
    ];
    if (s.longest) out.push({ label: "longest life", value: life(s.longest.duration_ms), note: s.longest.name, href: osHref.soul(data.cycle, s.longest.turn) });
    out.push({ label: "deaths", value: String(s.deaths) });
    if (s.graves) out.push({ label: "graves claimed", value: s.graves.total ? `${s.graves.claimed} of ${s.graves.total}` : "none" });
    if (s.registered !== null) out.push({ label: "signed up", value: String(s.registered) });
    return out;
  });
  const recordTiles = $derived((data.records ?? []).map((r): Tile => ({ label: r.title, value: r.display, note: `${r.name}, turn ${r.turn}`, href: osHref.soul(data.cycle, r.turn) })));
  const steps = $derived(souls.map((x) => ({ key: String(x.turn), label: String(x.turn), state: x.outcome === "died" ? ("dead" as const) : x.outcome === "playing" ? ("now" as const) : ("plain" as const), title: `Turn ${x.turn}, ${x.name}, ${outcomeLabel(x.outcome).toLowerCase()}`, href: osHref.soul(x.cycle, x.turn) })));
</script>

<PageHead path="~/one-soul" cmd="cat" args="rounds/{data.cycle}.md" title="round {data.cycle}" note={when}>
  <OsTabs />
</PageHead>

<Window path="~/one-soul/rounds/{data.cycle}" tone={over ? "pine" : "gold"}>
  <WindowHead title="Round {data.cycle}" asof={over ? "over" : "running"} />
  {#if steps.length}<div class="os-ladder"><Ladder label="Turns" {steps} /></div>{/if}
  <Tiles items={tiles} />
  {#if over && s.seed !== null && s.seed !== undefined}<p class="c1 os-seed">World seed <span class="num">{s.seed}</span>{#if s.archive}, archived as <span class="num">{s.archive}</span>{/if}.</p>{/if}
</Window>

{#if recordTiles.length}
  <Window path="~/one-soul/rounds/{data.cycle}" args="--records">
    <WindowHead title="Records of the round" />
    <Tiles items={recordTiles} />
  </Window>
{/if}

{#if data.map}
  <Window path="~/one-soul/map" args="--round {data.cycle}">
    <WindowHead title="Map" />
    <RoundMap
      mode="card"
      world={data.map.tile.view}
      map={data.map.layers.find((m) => m.dim === data.map!.tile.dim)}
      cycle={data.cycle}
      worlds={data.map.tile.worlds.map((w) => ({ id: w.id, label: w.label, href: withParams(page.url, { world: w.id }) }))}
      openHref="/one-soul/map?round={data.cycle}&world={data.map.tile.view.id}"
      tableHref="/one-soul/map?round={data.cycle}&view=tables"
      liveHref={data.map.tile.running ? "/one-soul/map/live.json" : null}
    />
  </Window>
{/if}

<Window path="~/one-soul/rounds/{data.cycle}" args="--souls">
  <WindowHead title="Souls" />
  {#if souls.length === 0}
    <EmptyState title="No soul has played in this round yet" />
  {:else}
    <div class="fx-scroll">
      <table class="fx-table">
        <thead>
          <tr><th scope="col" class="r">Turn</th><th scope="col">Soul</th><th scope="col" class="r">Lived</th><th scope="col">Outcome</th><th scope="col">How it ended</th></tr>
        </thead>
        <tbody>
          {#each souls as x (x.turn)}
            <tr>
              <td class="r">{x.turn}</td>
              <td><a class="lnk" href={osHref.soul(x.cycle, x.turn)}>{x.name}</a></td>
              <td class="r">{x.duration_ms === null ? "playing" : life(x.duration_ms)}</td>
              <td><Outcome outcome={x.outcome} /></td>
              <td class="os-cause">{#if x.cause}<q>{x.cause}</q>{/if}{#if x.has_journal && x.outcome !== "playing"}{" "}<a class="lnk i" href={osHref.journal(x.cycle, x.turn)}>journal</a>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Window>

{#if data.scoped}
  <div class="fx-grid three os-boards">
    {#if data.boards.playtime}<BarList title="Most time in this world" sub="spectating counts" rows={barRows(data.boards.playtime.data)} faces emptyTitle="Nobody has played yet" />{/if}
    {#if data.boards.mined}<BarList title="Blocks mined" sub="this round" rows={barRows(data.boards.mined.data)} faces emptyTitle="Nobody has mined yet" />{/if}
    {#if data.boards.killed}<BarList title="Mobs killed" sub="this round" rows={barRows(data.boards.killed.data)} faces emptyTitle="Nobody has killed a mob yet" />{/if}
  </div>
{/if}
{#if data.firsts}<MilestoneFeed result={data.firsts} title="Firsts in this round" limit={8} />{/if}
{#if data.advancements}<AdvancementFeed result={data.advancements} title="Advancement firsts in this round" showServer={false} limit={8} />{/if}

<Window path="~/one-soul/graveyard" args="--round {data.cycle}">
  <WindowHead title="Graves" />
  {#if graves.length === 0}
    <EmptyState title="No graves in this round" line="A grave appears where a soul dies for good." />
  {:else}
    <p><span class="num">{graves.filter((g) => g.claimed_by).length}</span> of <span class="num">{graves.length}</span> claimed. <a class="lnk" href="{osHref.graveyard}?round={data.cycle}">See the graveyard</a>.</p>
  {/if}
</Window>

{#if over}
  <Window path="~/one-soul/rounds/{data.cycle}" args="--haunting">
    <WindowHead title="Haunting" />
    {#if data.pranks && data.pranks.ghosts.length}
      <RankList
        label="Ghosts by pranks"
        compact
        rows={data.pranks.ghosts.map((g, i) => ({
          key: g.uuid,
          rank: i + 1,
          label: g.name,
          uuid: g.uuid,
          href: osHref.player(g.uuid),
          sub: Object.entries(g.kinds)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => `${titleId(k)} ${n}`)
            .join(" · "),
          value: `${g.total} pranks`
        }))}
      />
    {:else if data.pranks}
      <EmptyState title="No ghost played a prank this round" />
    {:else}
      <Notice kind="info">Prank counts per ghost show here once the server shares them for finished rounds.</Notice>
    {/if}
  </Window>
{/if}

<style>
  .os-ladder {
    margin-bottom: 16px;
  }
  .os-seed {
    margin-top: 12px;
    font-size: 14px;
  }
  .os-cause {
    white-space: normal;
    min-width: 22ch;
    max-width: 52ch;
    overflow-wrap: anywhere;
  }
  .os-boards > :global(*) {
    min-width: 0;
  }
</style>
