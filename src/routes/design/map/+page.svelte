<script lang="ts">
  // FM-0's preview of the map contracts on the mock: the servers and worlds /v2/map lists, one world's tiles
  // (the 3×3 rendered area at zoom.max, blocks -512..1023) and the players on it as dots. Not the map page
  // (FM-3, FM-4 build that); here to check the fixtures and the hide wrapper by eye.
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { tilePath, tileVersion } from "#lib/map/links.ts";
  import { Map as MapIcon } from "@lucide/svelte";
  let { data } = $props();
  const LO = -512;
  const SPAN = 1536;
  const tiles = $derived.by(() => {
    const v = data.view;
    if (!v) return [];
    const out: { key: string; src: string }[] = [];
    for (const y of [-1, 0, 1])
      for (const x of [-1, 0, 1]) {
        const k = `${v.zoom.max}/${x}/${y}`;
        const ver = v.tiles.epoch ? tileVersion(v.tiles.epoch, v.tiles.versions[k] ?? 0) : null;
        out.push({ key: k, src: tilePath(v.server, v.id, { z: v.zoom.max, x, y }, ver) });
      }
    return out;
  });
  const here = $derived(data.view ? data.players.filter((p) => p.world === data.view!.id) : []);
  const pct = (n: number) => `${(((n - LO) / SPAN) * 100).toFixed(3)}%`;
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Map preview</h1>
    <p class="fp-lede">The map client on the mock: servers, worlds, tiles and live positions, before the map itself exists.</p>
  </header>

  {#if !data.servers.ok && data.servers.kind === "off"}
    <EmptyState icon={MapIcon} title="There is no map on this network" />
  {:else if !data.servers.ok}
    <Notice kind="warning"><b>cakeutils could not be reached.</b></Notice>
  {:else if data.servers.data.servers.length === 0}
    <EmptyState icon={MapIcon} title="No server has a map yet" line="A server's map shows up here as soon as it shares one." />
  {:else}
    <section class="fp-section">
      <h2 class="t-title-2">Servers and worlds</h2>
      <div class="fp-table__wrap fp-card">
        <table class="fp-table mp-table">
          <thead><tr><th>Server</th><th>World</th><th class="mp-wide">Dimension</th><th>Positions</th><th>Change log</th></tr></thead>
          <tbody>
            {#each data.servers.data.servers as s (s.server)}
              {#each s.worlds as w, i (w.id)}
                <tr>
                  <td>{#if i === 0}<a href="?server={s.server}">{s.display_name}</a>{/if}</td>
                  <td><a href="?server={s.server}&world={w.id}">{w.name}</a></td>
                  <td class="t-mono t-small mp-wide">{w.dimension ?? "unknown"}</td>
                  <td>{#if i === 0}{s.live_players ? "on" : "off"}{/if}</td>
                  <td>{#if i === 0}{s.changes ? "yes" : "no"}{/if}</td>
                </tr>
              {/each}
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    {#if data.view}
      {@const v = data.view}
      <section class="fp-section">
        <div class="fp-section__head">
          <h2 class="t-title-2">{v.name}</h2>
          <p class="t-small t-muted t-mono">{v.server} · {v.id} · zoom {v.zoom.min}..{v.zoom.max} (+{v.zoom.extra}) · spawn x {v.spawn.x}, z {v.spawn.z}</p>
        </div>
        <div class="mp-frame fp-card" role="img" aria-label="{v.name} of {v.server}, blocks -512 to 1023, with {here.length} player{here.length === 1 ? '' : 's'}">
          <div class="mp-tiles">
            {#each tiles as t (t.key)}<img src={t.src} alt="" width="512" height="512" loading="lazy" />{/each}
          </div>
          {#each here as p (p.uuid)}
            <span class="mp-dot" style:left={pct(p.x)} style:top={pct(p.z)} title={p.name}><span class="mp-dot__name">{p.name}</span></span>
          {/each}
        </div>
        {#if data.positions === "off"}
          <p class="t-small t-muted">Live positions are off for this server.</p>
        {:else if data.positions === "down"}
          <Notice kind="warning">Positions could not be read.</Notice>
        {:else if here.length === 0}
          <p class="t-small t-muted">No one is in this world right now.</p>
        {:else}
          <div class="fp-table__wrap fp-card">
            <table class="fp-table">
              <thead><tr><th>Player</th><th class="num">x</th><th class="num">z</th><th class="num">Yaw</th></tr></thead>
              <tbody>
                {#each here as p (p.uuid)}<tr><td>{p.name}</td><td class="num">{p.x}</td><td class="num">{p.z}</td><td class="num">{p.yaw}°</td></tr>{/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {/if}
  {/if}
</div>

<style>
  .mp-table th, .mp-table td { white-space: nowrap; }
  @media (max-width: 640px) { .mp-wide { display: none; } }
  .mp-frame { position: relative; max-width: 768px; overflow: hidden; padding: 0; }
  .mp-tiles { display: grid; grid-template-columns: repeat(3, 1fr); }
  .mp-tiles img { display: block; width: 100%; height: auto; image-rendering: pixelated; }
  .mp-dot {
    position: absolute; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%;
    background: var(--acc); border: 2px solid var(--surface); box-shadow: var(--shadow-card);
  }
  .mp-dot__name {
    position: absolute; left: 14px; top: -4px; white-space: nowrap; padding: 0 var(--space-1);
    font: 600 11px/16px var(--font-mono); color: var(--text); background: var(--surface); border-radius: var(--radius-sm);
  }
</style>
