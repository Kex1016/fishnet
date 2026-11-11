<script lang="ts">
  import { page } from "$app/state";
  import { Map as MapIcon } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { DataTable, ViewSwitch } from "#lib/charts/index.ts";
  import WorldMap from "#lib/onesoul/WorldMap.svelte";
  import type { LayerId } from "#lib/onesoul/map.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();

  const NAMES: Record<LayerId, string> = { trails: "Trails", deaths: "Deaths", graves: "Graves", waystones: "Waystones", spawn: "Spawn" };
  let show = $state<Record<LayerId, boolean>>({ trails: true, deaths: true, graves: true, waystones: true, spawn: true });
  const KIND: Record<string, string> = { spawn: "Spawn", death: "Death", grave: "Grave", waystone: "Waystone", other: "Point" };
</script>

<div class="fp-page">
  <section class="fp-section">
    <div class="fp-section__head">
      <h1 class="t-display">Map, round {data.cycle}</h1>
      {#if data.ok && data.asOf}<AsOf at={data.asOf} stale={data.stale} />{/if}
    </div>
    <p class="t-body t-muted">Where souls walked, died and left their graves, one map per dimension in block coordinates: x runs east, z runs south. The soul who is playing now is not on the map until their turn ends.</p>
    <div class="os-controls">
      {#if data.rounds.length > 1}
        <nav class="fp-seg" aria-label="Round">
          {#each data.rounds as r (r)}<a href={withParams(page.url, { round: String(r) })} aria-current={r === data.cycle ? "page" : undefined}>Round {r}</a>{/each}
        </nav>
      {/if}
      <ViewSwitch url={page.url} view={data.view} />
    </div>
    {#if data.ok && data.view === "charts" && data.layers.length > 1}
      <fieldset class="os-layers">
        <legend class="visually-hidden">Layers</legend>
        {#each data.layers as l (l)}
          <label class="os-layer os-layer--{l}"><input type="checkbox" bind:checked={show[l]} /><span class="os-key" aria-hidden="true"></span>{NAMES[l]}</label>
        {/each}
      </fieldset>
    {/if}
  </section>

  {#if !data.ok}
    <Notice kind="warning">The map could not be loaded right now.</Notice>
  {:else if data.maps.length === 0}
    <EmptyState icon={MapIcon} title="Nothing on the map yet" line="Deaths, graves, waystones and trails appear here as the round goes on." />
  {:else if data.view === "tables"}
    {#each data.maps as m (m.dim)}
      <section class="fp-section">
        <h2 class="t-title-3">{m.label}</h2>
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
      </section>
    {/each}
  {:else}
    <div class="os-maps">
      {#each data.maps as m (m.dim)}
        <section class="fp-card os-mapcard"><WorldMap map={m} {show} /></section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .os-controls {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .os-layers {
    border: 0;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
  }
  .os-layer {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font: 400 14px/20px var(--font-text);
    cursor: pointer;
  }
  .os-key {
    width: 12px;
    height: 12px;
    display: inline-block;
  }
  .os-layer--trails .os-key {
    height: 3px;
    background: var(--acc-viz);
  }
  .os-layer--deaths .os-key {
    background:
      linear-gradient(45deg, transparent 42%, var(--error-ink) 42% 58%, transparent 58%),
      linear-gradient(-45deg, transparent 42%, var(--error-ink) 42% 58%, transparent 58%);
  }
  .os-layer--graves .os-key {
    width: 9px;
    background: var(--text);
  }
  .os-layer--waystones .os-key {
    background: var(--soul);
    transform: rotate(45deg) scale(0.75);
  }
  .os-layer--spawn .os-key {
    border-radius: 50%;
    border: 2px solid var(--acc);
    background: radial-gradient(var(--acc) 30%, transparent 32%);
  }
  .os-maps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
    gap: var(--space-4);
  }
  .os-mapcard {
    padding: var(--space-4);
  }
</style>
