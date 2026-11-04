<script lang="ts">
  import Notice from "#lib/design/Notice.svelte";
  import Stub from "#lib/design/Stub.svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  let { data } = $props();
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Servers</h1>
    <p class="fp-lede">Every server on the network, what is running on it and who is on.</p>
    <Stub unit="W4" what="this page" />
  </header>
  {#if !data.network.ok}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> The servers will be back when it is.</Notice>
  {:else}
    <div class="fp-panels">
      {#each data.network.data.servers as s (s.id)}
        <a class="fp-panel" href="/servers/{s.id}" style="color: inherit; text-decoration: none">
          <div class="fp-section__head"><h2 class="t-title-3">{s.display_name}</h2>{#if s.mc_version}<span class="fp-tag fp-tag--success">{s.platform} {s.mc_version}</span>{:else}<span class="fp-tag">not linked</span>{/if}</div>
          <p class="t-small t-muted"><span class="t-num">{s.online}</span> online{#if s.waiting}, <span class="t-num">{s.waiting}</span> waiting{/if}</p>
        </a>
      {/each}
    </div>
    <AsOf at={data.network.asOf} stale={data.network.stale} />
  {/if}
</div>
