<script lang="ts">
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { Sparkline } from "#lib/charts/index.ts";
  import { titleCase } from "#lib/players/names.ts";
  let { data } = $props();
  const net = $derived(data.network);
  const linked = $derived(data.servers.filter((s) => s.mc_version).length);
  const lede = $derived.by(() => {
    if (!net.ok) return "The doors are out of sight for a moment. They will be back when the network is.";
    const n = data.servers.length;
    if (n === 0) return "No doors lead off the lobby yet.";
    return `${n} ${n === 1 ? "server" : "servers"} on the network, ${linked} linked right now.`;
  });
</script>

<PageHead path="~/servers" cmd="ls" args="-l" title="servers" {lede} note="Every server on the network, what is running on it and who is on." />

{#if !net.ok}
  <Notice kind="warning"><b>cakeutils could not be reached.</b> The servers will be back when it is.</Notice>
{:else if net.data.servers.length === 0}
  <Window path="~/servers">
    <EmptyState title="No servers are linked yet" line="Servers show up here as soon as they connect to the network." />
  </Window>
{:else}
  <p class="c1"><span class="num">{net.data.total_online}</span> online on the network · <AsOf at={net.asOf} stale={net.stale} /></p>
  <div class="fx-grid">
    {#each data.servers as s (s.id)}
      <Window shell="server" path={s.id} tone={s.mc_version ? "pine" : "off"}>
        <WindowHead title={s.display_name} href="/servers/{s.id}" asof={s.mc_version ? `${s.platform ? titleCase(s.platform) : "Server"} ${s.mc_version}` : "Not linked"} />
        <div class="fx-read"><span class="big num">{s.online}</span><p class="cap">online{#if s.waiting} · {s.waiting} waiting{/if}</p></div>
        {#if s.spark && s.mc_version}<Sparkline points={s.spark} width={160} label="{s.display_name}, players online, recent" />{/if}
        {#if s.spark && s.mc_version}<p class="cap">players online, recent</p>{/if}
        {#if s.faces.length}
          <div class="hr"></div>
          <div class="fx-faces">
            {#each s.faces as p (p.uuid)}<a href="/players/{encodeURIComponent(p.name)}" title={p.name}><Face uuid={p.uuid} name={p.name} size="sm" /><span>{p.name}</span></a>{/each}
            {#if s.more}<a href="/servers/{s.id}" title="{s.more} more"><span>+{s.more}</span></a>{/if}
          </div>
        {:else if s.mc_version && s.online === 0}
          <p class="cap">Nobody is on right now.</p>
        {/if}
        {#if s.minis.length}
          <div class="hr"></div>
          <span class="lab">mini-servers</span>
          <div class="list">
            {#each s.minis as m (m.id)}<div class="li"><span class="mk">»</span><span class="grow">{m.name}</span><span class="meta">{m.count} on</span></div>{/each}
          </div>
        {/if}
        {#if !s.mc_version}
          <div class="fx-empty"><b>Not linked</b>{s.display_name} shows up here as soon as it connects to the network.</div>
        {/if}
      </Window>
    {/each}
  </div>
{/if}
