<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { DataTable } from "#lib/charts/index.ts";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import RoundMap from "#lib/map/layers/RoundMap.svelte";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();

  const KIND: Record<string, string> = { spawn: "Spawn", death: "Death", grave: "Grave", waystone: "Waystone", portal: "Stable portal", end_portal: "End portal", other: "Point" };
  // every round is drawn on its tiles, full bleed (design §8.1); ?view=tables lists the same points in tables
  const tiled = $derived(data.ok && data.tile !== null && data.view !== "tables");
  const q = (extra: Record<string, string | null>) => withParams(page.url, extra);
</script>

{#if data.ok && data.tile && tiled}
  <OsTabs bar />
  <RoundMap
    world={data.tile.view}
    map={data.maps.find((m) => m.dim === data.tile!.dim)}
    cycle={data.cycle}
    worlds={data.tile.worlds.map((w) => ({ id: w.id, label: w.label, href: q({ world: w.id }) }))}
    rounds={data.rounds.map((r) => ({ cycle: r, href: q({ round: String(r), world: null }) }))}
    tableHref={q({ view: "tables" })}
    liveHref={data.running ? "/one-soul/map/live.json" : null}
  />
{:else}
  <PageHead
    path="~/one-soul"
    cmd="open"
    args="map-round-{data.cycle}"
    title="map"
    lede="Where souls walked, died and left their graves, on the round's own map, in block coordinates: x runs east, z runs south. While a round runs, the map shows what has been explored and where the living soul is now."
    note="round {data.cycle}"
  >
    <OsTabs />
    <div class="fx-filters">
      {#if data.rounds.length > 1}
        <Segmented label="Round" options={data.rounds.map((r: number) => ({ href: q({ round: String(r) }), label: `round ${r}`, current: r === data.cycle }))} />
      {/if}
      <Segmented
        label="Map or table"
        options={[
          { href: q({ view: null }), label: "map", current: data.view === "charts" },
          { href: q({ view: "tables" }), label: "table", current: data.view === "tables" }
        ]}
      />
    </div>
  </PageHead>

{#if !data.ok}
    <Notice kind="warning">The map could not be loaded right now.</Notice>
  {:else if data.maps.length === 0}
    <EmptyState title="Nothing on the map yet" line="Deaths, graves, waystones and trails appear here as the round goes on." />
  {:else}
    {#if data.view !== "tables"}
      {#if data.prep}
        <Notice kind="info">The round has not started yet: its map appears when the first soul plays.</Notice>
      {:else}
        <Notice kind="warning">The map tiles could not be loaded right now. The same points are listed below.</Notice>
      {/if}
    {/if}
    {#each data.maps as m (m.dim)}
      <Window path="~/one-soul/map" args="--table {m.label.toLowerCase()}">
        <WindowHead title={m.label}>{#if data.asOf}<AsOf at={data.asOf} stale={data.stale} />{/if}</WindowHead>
        <DataTable
          caption="Points in {m.label}"
          columns={[
            { key: "kind", label: "What" },
            { key: "title", label: "Name" },
            { key: "detail", label: "Detail" },
            { key: "x", label: "x", num: true },
            { key: "y", label: "y", num: true },
            { key: "z", label: "z", num: true }
          ]}
          rows={m.marks.map((k) => ({ kind: KIND[k.kind] ?? "Point", title: k.title, detail: k.detail ?? "", x: Math.round(k.x), y: k.y === null ? null : Math.round(k.y), z: Math.round(k.z) }))}
        />
        {#if m.paths.length}
          <DataTable
            caption="Trails in {m.label}"
            columns={[
              { key: "title", label: "Soul" },
              { key: "detail", label: "Stay" },
              { key: "n", label: "Positions", num: true }
            ]}
            rows={m.paths.map((p) => ({ title: p.title, detail: p.detail ?? "", n: p.points.length }))}
          />
        {/if}
      </Window>
    {/each}
  {/if}
{/if}
