<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import KeyValueSheet from "#lib/design/KeyValueSheet.svelte";
  import KV from "#lib/design/KV.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import { dimLabel, life, titleId } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { day } from "#lib/format/dates.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
</script>

<PageHead path="~/one-soul" cmd="ls" args="graveyard/" title="graveyard" lede="When a soul dies for good, a grave keeps their items until someone claims it.">
  <OsTabs />
  <div class="fx-filters">
    <Segmented
      label="Round"
      options={[{ href: withParams(page.url, { round: null }), label: "all rounds", current: data.round === null }, ...data.rounds.map((r: number) => ({ href: withParams(page.url, { round: String(r) }), label: `round ${r}`, current: r === data.round }))]}
    />
    <Segmented
      label="Claimed"
      options={[
        { href: withParams(page.url, { claimed: null }), label: "all", current: data.claimed === null },
        { href: withParams(page.url, { claimed: "false" }), label: "open", current: data.claimed === false },
        { href: withParams(page.url, { claimed: "true" }), label: "claimed", current: data.claimed === true }
      ]}
    />
  </div>
</PageHead>

{#if !data.graves || !data.graves.ok}
  <Notice kind="warning">The graveyard could not be loaded right now.</Notice>
{:else if data.graves.data.graves.length === 0}
  <EmptyState title={data.claimed === null ? "No graves yet" : data.claimed ? "No grave has been claimed" : "No grave is open"} line="A grave appears where a soul dies for good." />
{:else}
  <div class="os-cards">
    {#each data.graves.data.graves as g (g.id)}
      <Window tag="article" shell="grave" path={g.soul.name} tone={g.claimed_by ? "foam" : "gold"}>
        <WindowHead title={g.claimed_by ? "Claimed" : "Open"} level={3} href={osHref.soul(g.cycle, g.soul.turn)} asof="round {g.cycle}, turn {g.soul.turn}" />
        <KeyValueSheet>
          <KV label="made">{day(g.created_at)}</KV>
          <KV label="items" num>{g.items}{g.marked ? `, ${g.marked} marked with love` : ""}</KV>
          <KV label="where">{dimLabel(g.dim)} <span class="num">{g.x} {g.y} {g.z}</span></KV>
          {#if g.claimed_by}
            <KV label="claimed by"><a class="lnk" href={osHref.player(g.claimed_by.uuid)}>{g.claimed_by.name}</a>{#if g.claimed_at}{" "}after {life(g.claimed_at - g.created_at)}{/if}</KV>
          {/if}
        </KeyValueSheet>
        {#if g.contents?.length}<p class="c1 os-items">{g.contents.slice(0, 6).map((c) => `${c.count} × ${titleId(c.item)}`).join(" · ")}</p>{/if}
      </Window>
    {/each}
  </div>
  <Pager url={page.url} total={data.graves.data.total} limit={data.limit} offset={data.offset} what="graves" />
  {#if data.graves.ok}<p class="os-asof"><AsOf at={data.graves.asOf} stale={data.graves.stale} /></p>{/if}
{/if}

<style>
  .os-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 40px 32px;
  }
  .os-items {
    margin-top: 12px;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .os-asof {
    align-self: flex-start;
    padding: 0 4px;
    background: var(--color-base);
  }
</style>
