<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { onMount } from "svelte";
  import { Flame, Hourglass, Moon, Wifi, WifiOff } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { StatTile } from "#lib/charts/index.ts";
  import Ticker from "#lib/onesoul/Ticker.svelte";
  import EventRow from "#lib/onesoul/EventRow.svelte";
  import { life, realmLabel, stateLabel, stateLine } from "#lib/onesoul/format.ts";
  import { dateTime } from "#lib/format/dates.ts";
  let { data } = $props();
  const card = $derived(data.card);
  const soul = $derived(card?.soul ?? null);
  const sc = $derived(soul?.second_chance ?? null);
  const r = $derived(card?.round);

  // the live card refreshes every 15 s (the site's cache floor for live data); clocks tick in between
  onMount(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") invalidate("onesoul:live");
    }, 15_000);
    return () => clearInterval(t);
  });
</script>

<div class="fp-page">
  {#if !card}
    <EmptyState icon={Flame} title="One Soul is not running here" line="The One Soul server has not reported its state yet." />
  {:else}
    <section class="fp-section">
      <div class="fp-section__head">
        <h1 class="t-display">{card.display_name}</h1>
        {#if data.asOf}<AsOf at={data.asOf} stale={data.stale} />{/if}
      </div>
      {#if data.stale}<Notice kind="warning">The One Soul server could not be reached. This is the last good state.</Notice>{/if}

      {#if soul}
        <article class="os-soul" aria-labelledby="os-soul-name">
          <div class="os-soul__who">
            <Face uuid={soul.uuid} name={soul.name} size="lg" />
            <div>
              <span class="t-kicker">The soul · turn {soul.turn}</span>
              <h2 class="t-title-1 os-soul__name" id="os-soul-name"><a href="/players/{encodeURIComponent(soul.name)}">{soul.name}</a></h2>
              <div class="os-soul__chips">
                {#if soul.online === true}<span class="fp-tag fp-tag--success"><Wifi class="fp-ico fp-ico--sm" strokeWidth={1.4} />Online</span>
                {:else if soul.online === false}<span class="fp-tag"><WifiOff class="fp-ico fp-ico--sm" strokeWidth={1.4} />Offline</span>{/if}
                {#if realmLabel(soul.realm)}<span class="fp-tag fp-tag--acc"><Moon class="fp-ico fp-ico--sm" strokeWidth={1.4} />In {realmLabel(soul.realm)}</span>{/if}
                {#if soul.phase === "second_chance"}<span class="fp-tag fp-tag--warning"><Hourglass class="fp-ico fp-ico--sm" strokeWidth={1.4} />On borrowed time</span>
                {:else}<span class="fp-tag"><Flame class="fp-ico fp-ico--sm" strokeWidth={1.4} />Alive</span>{/if}
              </div>
            </div>
          </div>
          <div class="os-soul__clocks">
            <div class="os-clock">
              <span class="os-clock__label">Alive for</span>
              <span class="os-clock__value"><Ticker ms={soul.alive_ms} from={card.updated_at} dir="up" running={soul.online !== false} style="life" /></span>
              <span class="os-clock__note">since {dateTime(soul.since)}</span>
            </div>
            {#if sc}
              <div class="os-clock os-clock--sc">
                <span class="os-clock__label">Borrowed time left</span>
                <span class="os-clock__value"><Ticker ms={sc.remaining_ms} from={card.updated_at} running={sc.paused !== true} /></span>
                <span class="os-clock__note">
                  {#if sc.paused}The clock stands while {soul.name} is offline.{:else}Runs only while {soul.name} is online.{/if}
                  {#if sc.offerings}{sc.offerings} offering{sc.offerings === 1 ? "" : "s"} burned{#if sc.added_ms}, {life(sc.added_ms)} bought{/if}.{/if}
                </span>
              </div>
            {/if}
          </div>
        </article>

        {#if soul.headline?.length}
          <div class="fp-section">
            <h2 class="t-title-3">This life so far</h2>
            <div class="fp-tiles os-tiles">
              {#each soul.headline as h (h.id)}<StatTile label={h.title} value={h.display} />{/each}
              {#if soul.waystones}<StatTile label="Waystones found" value={String(soul.waystones)} />{/if}
            </div>
          </div>
        {/if}
      {:else}
        <article class="os-soul os-soul--empty">
          <div>
            <span class="t-kicker">{stateLabel(card.state)}</span>
            <h2 class="t-title-1">
              {#if card.state === "prep"}Sign-ups are open{:else if card.state === "grace"}Grace period{:else}Nobody is playing right now{/if}
            </h2>
            <p class="t-body t-muted">{stateLine(card.state)}</p>
          </div>
          {#if card.state === "prep" && r?.prep_ends_at}
            <div class="os-clock">
              <span class="os-clock__label">The world opens in</span>
              <span class="os-clock__value"><Ticker ms={r.prep_ends_at - card.updated_at} from={card.updated_at} /></span>
              <span class="os-clock__note">at {dateTime(r.prep_ends_at)}, unless sign-ups are extended</span>
            </div>
          {:else if card.state === "grace" && r?.grace_ends_at}
            <div class="os-clock">
              <span class="os-clock__label">Grace ends in</span>
              <span class="os-clock__value"><Ticker ms={r.grace_ends_at - card.updated_at} from={card.updated_at} /></span>
              <span class="os-clock__note">at {dateTime(r.grace_ends_at)}</span>
            </div>
          {/if}
        </article>
      {/if}
    </section>

    {#if r}
      <section class="fp-section">
        <h2 class="t-title-3">Round {card.cycle}</h2>
        <div class="fp-tiles os-tiles">
          <StatTile label="Souls so far" value={String(r.played)} />
          <!-- a count only: the order of the queue is secret -->
          <StatTile label="Waiting for a turn" value={String(r.waiting)} />
          <StatTile label="Signed up" value={String(r.registered)} />
          {#if r.graves}<StatTile label="Graves claimed" value={r.graves.total ? `${r.graves.claimed} of ${r.graves.total}` : "None yet"} />{/if}
          {#if r.longest}<StatTile label="Longest life" value={life(r.longest.duration_ms)} note={`${r.longest.name}, turn ${r.longest.turn}`} />{/if}
        </div>
      </section>
    {/if}

    <div class="os-two">
      <section class="fp-section">
        <h2 class="t-title-3">The last soul</h2>
        {#if card.previous}
          {@const p = card.previous}
          <div class="fp-card os-prev">
            <div class="os-prev__who">
              <Face uuid={p.uuid} name={p.name} />
              <div>
                <a class="os-prev__name" href="/players/{encodeURIComponent(p.name)}">{p.name}</a>
                <div class="t-small t-muted">Turn {p.turn} · lived {life(p.duration_ms)}</div>
              </div>
            </div>
            {#if p.cause}<q class="os-prev__cause">{p.cause}</q>{/if}
            <div class="os-soul__chips">
              {#if p.grave_id}<span class="fp-tag">{p.grave_claimed ? "Grave claimed" : "Grave still open"}</span>{/if}
              {#if p.has_journal}<span class="fp-tag fp-tag--acc">Journal published</span>{/if}
            </div>
          </div>
        {:else}
          <EmptyState title="No soul has finished a turn yet" line="The first soul's story shows here when their turn ends." />
        {/if}
      </section>

      <section class="fp-section">
        <h2 class="t-title-3">Lately</h2>
        {#if card.recent.length}
          <ul class="os-events">
            {#each card.recent as e, i (i)}<EventRow {e} now={card.updated_at} />{/each}
          </ul>
        {:else}
          <EmptyState title="Nothing has happened yet" line="Sign-ups, souls, deaths and graves show up here as they happen." />
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  .os-soul {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-6);
    align-items: center;
    padding: var(--space-6);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-2xl);
    box-shadow: var(--shadow-card);
  }
  .os-soul--empty {
    align-items: end;
  }
  .os-soul__who {
    display: flex;
    gap: var(--space-4);
    align-items: center;
    min-width: 0;
  }
  .os-soul__name {
    margin: var(--space-1) 0 var(--space-2);
    overflow-wrap: anywhere;
  }
  .os-soul__name a {
    color: var(--soul-ink, var(--text));
  }
  .os-soul__chips {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .os-soul__clocks {
    display: flex;
    gap: var(--space-6);
    flex-wrap: wrap;
  }
  .os-clock {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 180px;
  }
  .os-clock__label {
    font: 600 11px/16px var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .os-clock__value {
    font: 600 28px/36px var(--font-mono);
    color: var(--text);
  }
  .os-clock--sc .os-clock__value {
    color: var(--warning-ink);
  }
  .os-clock__note {
    font: 400 12px/18px var(--font-text);
    color: var(--muted);
    max-width: 32ch;
  }
  .os-tiles {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
  .os-two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: var(--space-6);
  }
  .os-prev {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
  }
  .os-prev__who {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }
  .os-prev__name {
    font: 600 15px/20px var(--font-text);
    color: var(--text);
    overflow-wrap: anywhere;
  }
  .os-prev__cause {
    color: var(--muted);
    font-style: italic;
    overflow-wrap: anywhere;
  }
  .os-events {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  @media (max-width: 760px) {
    .os-soul {
      grid-template-columns: minmax(0, 1fr);
      padding: var(--space-4);
    }
    .os-two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
