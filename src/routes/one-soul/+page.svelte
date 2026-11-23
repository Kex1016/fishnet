<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { onMount } from "svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import KeyValueSheet from "#lib/design/KeyValueSheet.svelte";
  import KV from "#lib/design/KV.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import Ticker from "#lib/onesoul/Ticker.svelte";
  import EventRow from "#lib/onesoul/EventRow.svelte";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import Tiles from "#lib/onesoul/Tiles.svelte";
  import type { Tile } from "#lib/onesoul/Tiles.svelte";
  import { life, realmLabel, stateLabel, stateLine } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { dateTime, day } from "#lib/format/dates.ts";
  let { data } = $props();
  const card = $derived(data.card);
  const soul = $derived(card?.soul ?? null);
  const sc = $derived(soul?.second_chance ?? null);
  const r = $derived(card?.round);
  const records = $derived((data.records ?? []).slice(0, 5));

  const LEDE = "Only one of you may live at a time. The others wait, and watch, and haunt.";
  const lede = $derived(soul ? `${LEDE} Right now the soul belongs to ${soul.name}.` : card ? `${LEDE} ${stateLine(card.state)}` : LEDE);

  const roundTiles = $derived.by((): Tile[] => {
    if (!r || !card) return [];
    const out: Tile[] = [
      { label: "souls so far", value: String(r.played) },
      // a count only: the order of the queue is secret
      { label: "waiting for a turn", value: String(r.waiting) },
      { label: "signed up", value: String(r.registered) }
    ];
    if (r.graves) out.push({ label: "graves claimed", value: r.graves.total ? `${r.graves.claimed} of ${r.graves.total}` : "none yet" });
    if (r.longest) out.push({ label: "longest life", value: life(r.longest.duration_ms), note: `${r.longest.name}, turn ${r.longest.turn}`, href: osHref.soul(card.cycle, r.longest.turn) });
    return out;
  });

  // the live card refreshes every 15 s (the site's cache floor for live data); clocks tick in between
  onMount(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") invalidate("onesoul:live");
    }, 15_000);
    return () => clearInterval(t);
  });
</script>

<PageHead path="~/one-soul" cmd="cat" args={card ? `round-${card.cycle}.md` : "state.md"} title="one soul" {lede}>
  <OsTabs />
</PageHead>

{#if !card}
  <EmptyState title="One Soul is not running here" line="The One Soul server has not reported its state yet." />
{:else}
  {#if data.stale}<Notice kind="warning">The One Soul server could not be reached. This is the last good state.</Notice>{/if}

  {#if soul}
    <Window tone="gold" shell="soul" path={soul.phase === "second_chance" ? "borrowed time" : "alive"} args="· round {card.cycle}, turn {soul.turn}">
      <div class="fx-grid wide os-center">
        <div class="fx-soul">
          <Face uuid={soul.uuid} name={soul.name} size="lg" frame="gold" />
          <div class="fx-stack os-who">
            <span class="lab">the living soul</span>
            <h2 class="name" id="os-soul-name"><a href="/players/{encodeURIComponent(soul.name)}">{soul.name}</a></h2>
            <p>
              {#if soul.online === true}<span class="c6">Online</span>{:else if soul.online === false}<span class="c1">Offline</span>{/if}{#if realmLabel(soul.realm)}{soul.online === true || soul.online === false ? " · " : ""}in {realmLabel(soul.realm)}{/if}
            </p>
            {#if soul.phase === "second_chance"}<p class="c3">On borrowed time.</p>{/if}
          </div>
        </div>
        <div class="fx-stack">
          <span class="lab">this life so far</span>
          <KeyValueSheet>
            <KV label="alive for" num><Ticker ms={soul.alive_ms} from={card.updated_at} dir="up" running={soul.online !== false} style="life" /></KV>
            {#if sc}
              <KV label="borrowed time left" num><span class="c3"><Ticker ms={sc.remaining_ms} from={card.updated_at} running={sc.paused !== true} /></span></KV>
            {/if}
            <KV label="since">{dateTime(soul.since)}</KV>
            {#each soul.headline ?? [] as h (h.id)}<KV label={h.title} num>{h.display}</KV>{/each}
            {#if soul.waystones}<KV label="waystones found" num>{soul.waystones}</KV>{/if}
          </KeyValueSheet>
          {#if sc}
            <p class="c1 os-note">
              {#if sc.paused}The clock stands while {soul.name} is offline.{:else}Runs only while {soul.name} is online.{/if}
              {#if sc.offerings}{sc.offerings} offering{sc.offerings === 1 ? "" : "s"} burned{#if sc.added_ms}, {life(sc.added_ms)} bought{/if}.{/if}
            </p>
          {/if}
        </div>
      </div>
    </Window>
  {:else}
    <Window shell="state" path={stateLabel(card.state)} tone={card.state === "prep" ? "gold" : "pine"}>
      <WindowHead title={card.state === "prep" ? "Sign-ups are open" : card.state === "grace" ? "Grace period" : "Nobody is playing right now"}>
        {#if data.asOf}<AsOf at={data.asOf} stale={data.stale} />{/if}
      </WindowHead>
      <p>{stateLine(card.state)}</p>
      {#if card.state === "prep" && r?.prep_ends_at}
        <KeyValueSheet>
          <KV label="the world opens in" num><Ticker ms={r.prep_ends_at - card.updated_at} from={card.updated_at} /></KV>
          <KV label="at">{dateTime(r.prep_ends_at)}, unless sign-ups are extended</KV>
        </KeyValueSheet>
      {:else if card.state === "grace" && r?.grace_ends_at}
        <KeyValueSheet>
          <KV label="grace ends in" num><Ticker ms={r.grace_ends_at - card.updated_at} from={card.updated_at} /></KV>
          <KV label="at">{dateTime(r.grace_ends_at)}</KV>
        </KeyValueSheet>
      {/if}
    </Window>
  {/if}

  <div class="fx-grid">
    {#if r}
      <Window path="~/one-soul/rounds/{card.cycle}">
        <WindowHead title="Round {card.cycle}" href={osHref.round(card.cycle)} asof={r.started_at ? `began ${day(r.started_at)}` : undefined} />
        <Tiles items={roundTiles} />
      </Window>
    {/if}

    <Window shell="grave" path={card.previous ? card.previous.name : "none yet"} tone={card.previous ? "love" : "off"}>
      <WindowHead title="The last soul" asof={card.previous ? `turn ${card.previous.turn}` : undefined} />
      {#if card.previous}
        {@const p = card.previous}
        <div class="fx-soul os-prev">
          <Face uuid={p.uuid} name={p.name} size="lg" frame="love" />
          <div class="fx-stack">
            <p class="c2 os-prev__name"><a class="c2" href="/players/{encodeURIComponent(p.name)}">{p.name}</a></p>
            {#if p.cause}<p><q>{p.cause}</q></p>{/if}
            <p>Lived <span class="num">{life(p.duration_ms)}</span>.</p>
            {#if p.grave_id}<p class="c1">{p.grave_claimed ? "The grave has been claimed." : "The grave is still open."}</p>{/if}
            <div class="fx-head row">
              <a class="c6" href={osHref.soul(card.cycle, p.turn)}>their turn</a>
              {#if p.has_journal}<a class="c7" href={osHref.journal(card.cycle, p.turn)}>read the journal</a>{/if}
            </div>
          </div>
        </div>
      {:else}
        <EmptyState title="No soul has finished a turn yet" line="The first soul's story shows here when their turn ends." />
      {/if}
    </Window>
  </div>

  <div class="fx-grid wide os-top">
    <Window path="~/one-soul/chronicle" args="| head">
      <WindowHead title="Lately" asof={data.asOf ? `as of ${dateTime(data.asOf).split(", ").at(-1)}` : undefined} />
      {#if card.recent.length}
        <div class="fx-feed">
          {#each card.recent as e, i (i)}<EventRow {e} now={card.updated_at} />{/each}
        </div>
        <p class="os-more"><a class="lnk" href={osHref.timeline}>the whole timeline</a></p>
      {:else}
        <EmptyState title="Nothing has happened yet" line="Sign-ups, souls, deaths and graves show up here as they happen." />
      {/if}
    </Window>

    {#if records.length}
      <Window path="~/one-soul/records">
        <WindowHead title="Records of the round" level={3} />
        <div class="fx-rank compact bare">
          {#each records as rec (rec.id)}
            <a class="row" href={osHref.soul(card.cycle, rec.turn)}>
              <span class="pos c3">★</span>
              <span class="who">{rec.title}<span class="sub">{rec.name}, turn {rec.turn}</span></span>
              <span class="val">{rec.display}</span>
            </a>
          {/each}
        </div>
      </Window>
    {/if}
  </div>
{/if}

<style>
  .os-center {
    align-items: center;
  }
  .os-who {
    min-width: 0;
  }
  .fx-soul .name {
    overflow-wrap: anywhere;
  }
  .fx-soul .name a {
    color: inherit;
  }
  .os-note {
    font-size: 14px;
    max-width: 48ch;
  }
  .os-prev {
    align-items: flex-start;
  }
  .os-prev__name {
    font-size: 24px;
    overflow-wrap: anywhere;
  }
  .os-top {
    align-items: start;
  }
  /* a record's name may take two lines */
  .fx-rank .who {
    white-space: normal;
  }
  .os-more {
    margin-top: 12px;
  }
  /* a record's second line sits under its name, not beside it */
  .fx-rank .who .sub {
    display: block;
    margin-left: 0;
  }
</style>
