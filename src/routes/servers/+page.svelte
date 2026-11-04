<script lang="ts">
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { Sparkline } from "#lib/charts/index.ts";
  import { titleCase } from "#lib/players/names.ts";
  let { data } = $props();
  const net = $derived(data.network);
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Servers</h1>
    <p class="fp-lede">Every server on the network, what is running on it and who is on.</p>
  </header>

  {#if !net.ok}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> The servers will be back when it is.</Notice>
  {:else if net.data.servers.length === 0}
    <EmptyState title="No servers are linked yet" line="Servers show up here as soon as they connect to the network." />
  {:else}
    <div class="fp-section__head">
      <p class="t-small t-muted"><span class="t-num">{net.data.total_online}</span> online on the network</p>
      <AsOf at={net.asOf} stale={net.stale} />
    </div>
    <div class="fp-panels">
      {#each data.servers as s (s.id)}
        <article class="fp-panel fp-server">
          <div class="fp-section__head">
            <h2 class="t-title-3"><a href="/servers/{s.id}">{s.display_name}</a></h2>
            {#if s.mc_version}<span class="fp-tag fp-tag--success">{s.platform ? titleCase(s.platform) : "Server"} {s.mc_version}</span>{:else}<span class="fp-tag">not linked</span>{/if}
          </div>
          <p class="t-small t-muted">
            <span class="t-num">{s.online}</span> online{#if s.waiting}, <span class="t-num">{s.waiting}</span> waiting{/if}{#if s.minis}, <span class="t-num">{s.minis}</span> mini-server{s.minis === 1 ? "" : "s"} running{/if}
          </p>
          {#if s.spark}<div class="fp-server__spark"><Sparkline points={s.spark} width={160} label="{s.display_name}, players online, recent" /></div>{/if}
          {#if s.faces.length}
            <div class="fp-faces">
              {#each s.faces as p (p.uuid)}<a href="/players/{encodeURIComponent(p.name)}" title={p.name}><Face uuid={p.uuid} name={p.name} size="sm" /></a>{/each}
              {#if s.more}<a class="fp-tag" href="/servers/{s.id}">+{s.more}</a>{/if}
            </div>
          {:else if s.online === 0}
            <p class="t-small t-faint">Nobody is on right now.</p>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .fp-server { display: flex; flex-direction: column; gap: var(--space-3); }
  .fp-server__spark { height: 28px; }
</style>
