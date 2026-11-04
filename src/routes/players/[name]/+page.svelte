<script lang="ts">
  import { page } from "$app/state";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Stub from "#lib/design/Stub.svelte";
  import { StatTile } from "#lib/charts/index.ts";
  import { Segments, StatsExplorer, isUuidName } from "#lib/players/index.ts";
  import { PlayerFirsts } from "#lib/milestones/index.ts";
  import { day, ago } from "#lib/format/dates.ts";
  import { durationMs } from "#lib/format/stat-display.ts";
  let { data } = $props();
</script>

<div class="fp-page">
  {#if !data.player.ok}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> This profile will be back when it is.</Notice>
  {:else}
    {@const p = data.player.data}
    <header class="fp-who">
      <Face uuid={p.uuid} name={p.name} size="lg" />
      <div>
        <h1 class="t-display"><Segments segments={p.prefix} />{isUuidName(p.name) ? "Unnamed player" : p.name}<Segments segments={p.suffix} /></h1>
        <p class="t-small t-muted">
          {#if p.online}<span class="fp-dot fp-dot--on"></span> Online on {p.server}{:else}Last seen {ago(p.last_seen)}{/if} · first seen {day(p.first_seen)}
        </p>
      </div>
    </header>
    <Stub unit="W5" what="this page" />
    <div class="fp-tiles">
      <StatTile label="Playtime" value={durationMs(p.playtime.total_ms)} note="network" />
      {#each Object.entries(p.playtime.by_server) as [s, ms] (s)}<StatTile label={s} value={durationMs(ms)} note="server" href="/servers/{s}" />{/each}
      {#each Object.entries(p.playtime.by_mini) as [m, ms] (m)}<StatTile label={m} value={durationMs(ms)} note="mini-server" />{/each}
    </div>
    <section class="fp-section">
      <div class="fp-section__head">
        <h2 class="t-title-2">Stats</h2>
        {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
      </div>
      <StatsExplorer url={page.url} scope={data.scope} type={data.type} q={data.q} types={data.types} stats={data.stats} />
    </section>
    <PlayerFirsts result={data.firsts} playerName={p.name} />
  {/if}
</div>

<style>
  .fp-who { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: var(--space-2) var(--space-5); align-items: center; }
</style>
