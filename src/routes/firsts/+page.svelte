<script lang="ts">
  // World firsts: every row has a picture (the catalogue's icon of what it is about, added by the load in
  // pictures.server.ts), what it was, who and when, like the milestone and advancement feeds.
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Feed from "#lib/design/Feed.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import When from "#lib/milestones/When.svelte";
  import { FIRST_KINDS, firstKind, firstLine } from "#lib/network/words.ts";
  import { iconHref } from "#lib/images.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const kinds = $derived([
    { href: withParams(page.url, { kind: null }), label: "All", current: data.kind === null },
    ...FIRST_KINDS.map((k) => ({ href: withParams(page.url, { kind: k.id }), label: k.label, current: data.kind === k.id }))
  ]);
</script>

<PageHead path="~/firsts" cmd="tail" args="firsts.log" title="firsts" lede="Somebody has to be first. Here is who it was, and when." note="Advancements and their parts, new dimensions and biomes, rare items and hours played, newest first.">
  <div class="fx-filters">
    {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} />{/if}
    <Segmented label="Kind" options={kinds} />
  </div>
</PageHead>

{#if data.mini}
  <Notice kind="info">Firsts are kept per server and for the whole network, not per mini-server. Pick a server or the network above.</Notice>
{:else if !data.feed || !data.feed.ok}
  <Notice kind="warning">Firsts could not be loaded right now.</Notice>
{:else if data.feed.data.firsts.length === 0}
  <Window path="~/firsts">
    <EmptyState title="No firsts yet" line=" Someone shows up here the moment they do something nobody on the network has done before." />
  </Window>
{:else}
  <Window path="~/firsts" args={data.kind ? `--kind ${data.kind}` : undefined}>
    <WindowHead title="{group(data.feed.data.total)} first{data.feed.data.total === 1 ? '' : 's'}"><AsOf at={data.feed.asOf} stale={data.feed.stale} /></WindowHead>
    <Feed label="Firsts">
      {#each data.feed.data.firsts as f, i (`${f.kind}-${f.uuid}-${f.title}-${i}`)}
        {@const line = firstLine(f)}
        {@const src = iconHref(f.icon)}
        <div class="li">
          <span class="pic" title={line.text}>{#if src}<img {src} alt="" width="20" height="20" loading="lazy" decoding="async" />{/if}</span>
          <span class="txt">
            <span>{#if line.href}<a href={line.href}>{line.text}</a>{:else}{line.text}{/if}{" "}<span class="c1 kind">{firstKind(f.kind)}</span></span>
            <span class="sub">
              {#if f.uuid && f.name}<PlayerName uuid={f.uuid} name={f.name} />{:else}First player unknown{/if}{#if data.scope === "network" && f.server}{" · on "}<a href="/servers/{encodeURIComponent(f.server)}">{data.serverNames[f.server] ?? f.server}</a>{/if}
            </span>
          </span>
          <When when={f.at === null ? { state: "before" } : { state: "at", at: f.at }} imported={f.imported} />
        </div>
      {/each}
    </Feed>
  </Window>
  <Pager url={page.url} total={data.feed.data.total} limit={data.limit} offset={data.offset} what="firsts" prev="newer" next="older" />
{/if}

<style>
  .kind { font-size: 12px; }
</style>
