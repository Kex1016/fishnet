<script lang="ts">
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import KeyValueSheet from "#lib/design/KeyValueSheet.svelte";
  import KV from "#lib/design/KV.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import Outcome from "#lib/onesoul/Outcome.svelte";
  import Tiles from "#lib/onesoul/Tiles.svelte";
  import type { Tile } from "#lib/onesoul/Tiles.svelte";
  import RoundMap from "#lib/map/layers/RoundMap.svelte";
  import { page } from "$app/state";
  import { withParams } from "#lib/url.ts";
  import { dimLabel, life, titleId } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { dateTime, day } from "#lib/format/dates.ts";
  import { subjectLabel, typeLabel } from "#lib/format/labels.ts";
  let { data } = $props();
  const s = $derived(data.soul);
  const byType = $derived.by(() => {
    const m = new Map<string, NonNullable<typeof data.stats>["stats"]>();
    for (const r of data.stats?.stats ?? []) m.set(r.type, [...(m.get(r.type) ?? []), r]);
    return [...m.entries()].map(([type, rows]) => ({ type, rows: [...rows].sort((a, b) => b.value - a.value) }));
  });
  const scr = $derived(s.second_chance_result ?? null);
  const tiles = $derived.by((): Tile[] => {
    const out: Tile[] = [{ label: data.playing ? "turn started" : "lived", value: data.playing ? day(s.started_at) : life(s.duration_ms), note: data.playing ? undefined : `${day(s.started_at)} to ${s.ended_at ? day(s.ended_at) : "?"}` }];
    if (s.death && !data.playing) out.push({ label: "died in", value: dimLabel(s.death.dim), note: `x ${s.death.x}, y ${s.death.y}, z ${s.death.z}` });
    if (s.waited_ms) out.push({ label: "waited for this turn", value: life(s.waited_ms), note: "from sign-up to turn" });
    if (scr) out.push({ label: "borrowed time", value: life(scr.used_ms), note: `${scr.offerings} offering${scr.offerings === 1 ? "" : "s"}, ${life(scr.added_ms)} bought, ${titleId(scr.outcome).toLowerCase()}` });
    if (s.waystones) out.push({ label: "waystones found", value: String(s.waystones) });
    return out;
  });
</script>

<PageHead path="~/one-soul" cmd="cat" args="rounds/{data.cycle}/{data.turn}.md" title={s.name} note="round {data.cycle}, turn {data.turn}">
  <OsTabs />
</PageHead>

<Window shell="soul" path={s.name} args="· {data.playing ? 'alive' : 'turn over'}" tone={data.playing ? "gold" : s.outcome === "died" ? "love" : "pine"}>
  <div class="fx-soul os-soul">
    <Face uuid={s.uuid} name={s.name} size="lg" frame={data.playing ? "gold" : s.outcome === "died" ? "love" : undefined} />
    <div class="fx-stack os-who">
      <span class="lab">round {data.cycle}, turn {data.turn}</span>
      <p class="os-name"><a class={data.playing ? "c3" : s.outcome === "died" ? "c2" : "c6"} href={osHref.player(s.uuid)}>{s.name}</a></p>
      <p>
        <Outcome outcome={s.outcome} />
        {#if s.second_chance}<span class="c3"> · had a second chance</span>{/if}
      </p>
      {#if s.cause}<p><q>{s.cause}</q></p>{/if}
      {#if s.has_journal}<div class="fx-head row"><a class="ink c7" href={osHref.journal(s.cycle, s.turn)}>read the journal</a></div>{/if}
    </div>
  </div>
</Window>

<Window path="~/one-soul/rounds/{data.cycle}/{data.turn}">
  <WindowHead title="The turn" />
  <Tiles items={tiles} />
  {#if s.headline?.length}
    <div class="os-sheet">
      <span class="lab">{data.playing ? "this life so far" : "this life"}</span>
      <KeyValueSheet>
        {#each s.headline as h (h.id)}<KV label={h.title} num>{h.display}</KV>{/each}
      </KeyValueSheet>
    </div>
  {/if}
</Window>

{#if data.tile}
  <Window path="~/one-soul/rounds/{data.cycle}/{data.turn}" args="--trail">
    <WindowHead title={data.playing ? "Where this life has gone so far" : "Where this life went"} />
    <RoundMap
      mode="card"
      world={data.tile.view}
      map={data.maps?.find((m) => m.dim === data.tile!.dim)}
      cycle={data.cycle}
      worlds={data.tile.worlds.map((w) => ({ id: w.id, label: w.label, href: withParams(page.url, { world: w.id }) }))}
      openHref="/one-soul/map?round={data.cycle}&world={data.tile.view.id}"
      liveHref={data.running ? "/one-soul/map/live.json" : null}
    />
  </Window>
{/if}

<Window shell="grave" path={data.grave ? (data.grave.claimed_by ? "claimed" : "open") : "none"} tone={data.grave ? (data.grave.claimed_by ? "foam" : "gold") : "off"}>
  <WindowHead title="Grave" />
  {#if data.grave}
    {@const g = data.grave}
    <KeyValueSheet>
      <KV label="items" num>{g.items}{g.marked ? `, ${g.marked} with the Mark of Love` : ""}</KV>
      <KV label="where">{dimLabel(g.dim)} <span class="num">{g.x} {g.y} {g.z}</span></KV>
      <KV label="state">
        {#if g.claimed_by}Claimed by <a class="lnk" href={osHref.player(g.claimed_by.uuid)}>{g.claimed_by.name}</a>{#if g.claimed_at}, {life(g.claimed_at - g.created_at)} after the death{/if}{:else}Still open since {dateTime(g.created_at)}{/if}
      </KV>
    </KeyValueSheet>
    {#if g.contents?.length}<p class="c1 os-contents">{g.contents.map((c) => `${c.count} × ${titleId(c.item)}`).join(" · ")}</p>{/if}
  {:else}
    <EmptyState title={data.playing ? "Still alive" : "No grave"} line={data.playing ? "A grave appears where a soul dies for good." : "This turn ended without a grave."} />
  {/if}
</Window>

{#if data.stats}
  <Window path="~/one-soul/rounds/{data.cycle}/{data.turn}" args="--stats">
    <WindowHead title="Run stats" asof={data.stats.final ? "counted over this turn only" : "this turn so far, still counting"} />
    {#if byType.length === 0}
      <EmptyState title="Nothing counted for this turn" />
    {:else}
      <div class="os-statgroups">
        {#each byType as g (g.type)}
          <div class="os-statgroup">
            <h3 class="lab">{typeLabel(g.type)}</h3>
            <ol class="os-statlist">
              {#each g.rows.slice(0, 8) as r (r.subject)}<li><span>{subjectLabel(r.name, r.subject)}</span><span class="num">{r.display}</span></li>{/each}
            </ol>
            {#if g.rows.length > 8}<span class="cap">and {g.rows.length - 8} more</span>{/if}
          </div>
        {/each}
      </div>
    {/if}
  </Window>
{/if}

<style>
  .os-soul {
    align-items: center;
  }
  .os-who {
    min-width: 0;
  }
  .os-name {
    font-size: 32px;
    overflow-wrap: anywhere;
  }
  .os-sheet {
    margin-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .os-contents {
    margin-top: 12px;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .os-statgroups {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 24px 32px;
  }
  .os-statgroup {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .os-statgroup h3 {
    margin: 0;
    font-weight: 400;
  }
  .os-statlist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .os-statlist li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 0;
    border-top: 1px solid var(--ink-hairline);
    font-size: 14px;
  }
  .os-statlist li:first-child {
    border-top: 0;
  }
  .os-statlist li > :first-child {
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
