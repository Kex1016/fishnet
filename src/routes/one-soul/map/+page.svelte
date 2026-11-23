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
  import WorldMap from "#lib/onesoul/WorldMap.svelte";
  import RoundMap from "#lib/map/layers/RoundMap.svelte";
  import type { LayerId } from "#lib/onesoul/map.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();

  const NAMES: Record<LayerId, string> = { trails: "Trails", deaths: "Deaths", graves: "Graves", waystones: "Waystones", spawn: "Spawn" };
  let show = $state<Record<LayerId, boolean>>({ trails: true, deaths: true, graves: true, waystones: true, spawn: true });
  const KIND: Record<string, string> = { spawn: "Spawn", death: "Death", grave: "Grave", waystone: "Waystone", other: "Point" };
  // a finished round with archived tiles is drawn on them, full bleed; ?view=tables lists the same points in tables
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
  />
{:else}
  <PageHead
    path="~/one-soul"
    cmd="open"
    args="map-round-{data.cycle}"
    title="map"
    lede="Where souls walked, died and left their graves, one map per dimension in block coordinates: x runs east, z runs south. The soul who is playing now is not on the map until their turn ends."
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
    {#if data.ok && data.view === "charts" && data.layers.length > 1}
      <fieldset class="os-layers">
        <legend class="visually-hidden">Layers</legend>
        {#each data.layers as l (l)}
          <label class="os-layer"><input class="visually-hidden" type="checkbox" bind:checked={show[l]} /><span class="box" aria-hidden="true">{show[l] ? "[x]" : "[ ]"}</span><span class="os-key os-key--{l}" aria-hidden="true"></span>{NAMES[l]}</label>
        {/each}
      </fieldset>
    {/if}
  </PageHead>

  {#if !data.ok}
    <Notice kind="warning">The map could not be loaded right now.</Notice>
  {:else if data.maps.length === 0}
    <EmptyState title="Nothing on the map yet" line="Deaths, graves, waystones and trails appear here as the round goes on." />
  {:else if data.view === "tables"}
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
          rows={m.marks.map((k) => ({ kind: KIND[k.kind], title: k.title, detail: k.detail ?? "", x: Math.round(k.x), y: k.y === null ? null : Math.round(k.y), z: Math.round(k.z) }))}
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
  {:else}
    <div class="os-maps">
      {#each data.maps as m (m.dim)}
        <Window path="~/one-soul/map" args="--{m.label.toLowerCase()}"><WorldMap map={m} {show} /></Window>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .os-layers {
    border: 0;
    margin: 0;
    padding: 0 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 24px;
    align-self: flex-start;
    background: var(--color-base);
  }
  .os-layer {
    display: inline-flex;
    align-items: center;
    gap: 1ch;
    min-height: var(--touch);
    cursor: pointer;
  }
  .os-layer:has(input:focus-visible) {
    outline: 2px solid var(--color-gold);
  }
  .os-layer .box {
    color: var(--color-foam);
  }
  .os-key {
    width: 12px;
    height: 12px;
    display: inline-block;
  }
  .os-key--trails {
    height: 3px;
    background: var(--color-foam);
  }
  .os-key--deaths {
    background:
      linear-gradient(45deg, transparent 42%, var(--color-love) 42% 58%, transparent 58%),
      linear-gradient(-45deg, transparent 42%, var(--color-love) 42% 58%, transparent 58%);
  }
  .os-key--graves {
    width: 9px;
    background: var(--color-text);
  }
  .os-key--waystones {
    background: var(--color-gold);
    transform: rotate(45deg) scale(0.75);
  }
  .os-key--spawn {
    border-radius: 50%;
    border: 2px solid var(--color-iris);
    background: radial-gradient(var(--color-iris) 30%, transparent 32%);
  }
  .os-maps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
    gap: 40px 32px;
  }
</style>
