<script lang="ts">
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Feed from "#lib/design/Feed.svelte";
  import FeedRow from "#lib/design/FeedRow.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import RankList from "#lib/design/RankList.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import { life } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { day } from "#lib/format/dates.ts";
  let { data } = $props();
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
</script>

<PageHead path="~/one-soul" cmd="cat" args="records.md" title="records" lede="The longest lives and the kindest strangers, over every round. A soul who is still playing joins these lists once their turn is over.">
  <OsTabs />
</PageHead>

{#if data.ok && data.capped}<Notice kind="info">Only the first 500 lives are counted here.</Notice>{/if}

{#if !data.ok}
  <Notice kind="warning">The records could not be loaded right now.</Notice>
{:else}
  <div class="fx-grid">
    <Window path="~/one-soul/records" args="--longest">
      <WindowHead title="Longest lives">{#if data.asOf}<AsOf at={data.asOf} stale={data.stale} />{/if}</WindowHead>
      {#if data.longest.length === 0}
        <EmptyState title="No life has ended yet" />
      {:else}
        <RankList
          label="Longest lives"
          compact
          rows={data.longest.map((s, i) => ({ key: `${s.cycle}/${s.turn}`, rank: i + 1, label: s.name, uuid: s.uuid, href: osHref.soul(s.cycle, s.turn), sub: `round ${s.cycle}, turn ${s.turn}`, value: life(s.duration_ms) }))}
        />
      {/if}
    </Window>

    <Window path="~/one-soul/records" args="--rounds">
      <WindowHead title="Best of each round" />
      {#if data.rounds.length === 0}
        <EmptyState title="No round has a finished life yet" />
      {:else}
        <RankList
          label="Best of each round"
          compact
          rows={data.rounds.map((r) => ({ key: String(r.cycle), rank: 0, label: r.longest!.name, uuid: r.longest!.uuid, href: osHref.soul(r.cycle, r.longest!.turn), sub: `round ${r.cycle}, ${plural(r.souls, "soul")}${r.ended_at ? "" : ", still running"}`, value: life(r.longest!.duration_ms) }))}
        />
      {/if}
    </Window>

    <Window path="~/one-soul/records" args="--graves">
      <WindowHead title="Graves claimed for others" />
      {#if !data.gravesOk}
        <Notice kind="warning">Graves could not be loaded right now.</Notice>
      {:else if data.claimers.length === 0}
        <EmptyState title="Nobody has claimed someone else's grave yet" />
      {:else}
        <RankList
          label="Graves claimed for others"
          compact
          rows={data.claimers.map((c, i) => ({ key: c.uuid, rank: i + 1, label: c.name, uuid: c.uuid, href: osHref.player(c.uuid), sub: `${plural(c.items, "item")} recovered`, value: String(c.graves) }))}
        />
      {/if}
    </Window>

    {#if data.haunts.length}
      <Window path="~/one-soul/records" args="--ghosts">
        <WindowHead title="Busiest ghost of each round" />
        <RankList
          label="Busiest ghost of each round"
          compact
          rows={data.haunts.map((h) => ({ key: String(h.cycle), rank: 0, label: h.ghost.name, uuid: h.ghost.uuid, href: osHref.player(h.ghost.uuid), sub: `round ${h.cycle}`, value: plural(h.ghost.total, "prank") }))}
        />
      </Window>
    {/if}

    <Window path="~/one-soul/records" args="--journals">
      <WindowHead title="Journals" />
      {#if data.journals.length === 0}
        <EmptyState title="No journal yet" line="A soul can write a journal; it is published when their turn ends." />
      {:else}
        <Feed label="Journals">
          {#each data.journals as s (`${s.cycle}/${s.turn}`)}
            <FeedRow uuid={s.uuid} href={osHref.journal(s.cycle, s.turn)} when="read">
              {s.name}
              {#snippet sub()}round {s.cycle}, turn {s.turn}{s.ended_at ? `, ${day(s.ended_at)}` : ""}{/snippet}
            </FeedRow>
          {/each}
        </Feed>
      {/if}
    </Window>
  </div>
{/if}
