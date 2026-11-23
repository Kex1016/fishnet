<script lang="ts">
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import Outcome from "#lib/onesoul/Outcome.svelte";
  import Tiles from "#lib/onesoul/Tiles.svelte";
  import type { Tile } from "#lib/onesoul/Tiles.svelte";
  import { life } from "#lib/onesoul/format.ts";
  import { osHref } from "#lib/onesoul/links.ts";
  import { day } from "#lib/format/dates.ts";
  let { data } = $props();
  const p = $derived(data.p);
  const lived = $derived(p.turns.filter((t) => t.outcome !== "playing" && t.duration_ms !== null).length);
  const rounds = $derived([...new Set([...p.registrations.map((r) => r.round), ...p.turns.map((t) => t.cycle)])].sort((a, b) => a - b));
  const tiles = $derived.by((): Tile[] => {
    const out: Tile[] = [
      { label: "turns", value: String(p.turns.length), note: lived === p.turns.length ? undefined : `${lived} finished` },
      { label: "longest life", value: p.best ? life(p.best.duration_ms) : "–", note: p.best ? `round ${p.best.cycle}, turn ${p.best.turn}` : "no finished turn yet", href: p.best ? osHref.soul(p.best.cycle, p.best.turn) : undefined },
      { label: "graves claimed", value: String(p.graves_claimed) },
      { label: "graves left unclaimed", value: String(p.graves_left_open) },
      { label: "journals", value: String(p.journals) }
    ];
    if (data.full) out.push({ label: "pranks as a ghost", value: String(p.pranks.total), note: "finished rounds only" });
    return out;
  });
</script>

<PageHead path="~/one-soul" cmd="cat" args="souls/{p.name}" title={p.name} note={rounds.length ? `signed up for ${rounds.length === 1 ? "round" : "rounds"} ${rounds.join(", ")}` : undefined}>
  <OsTabs />
  <div class="fx-head row"><a class="c6" href={`/players/${p.uuid}`}>network profile</a></div>
</PageHead>

<Window shell="soul" path={p.name}>
  <div class="fx-soul os-soul">
    <Face uuid={p.uuid} name={p.name} size="lg" />
    <div class="os-tiles"><Tiles items={tiles} /></div>
  </div>
</Window>

<Window path="~/one-soul/souls/{p.name}" args="--turns">
  <WindowHead title="Turns">{#if data.asOf}<AsOf at={data.asOf} />{/if}</WindowHead>
  {#if p.turns.length === 0}
    <EmptyState title="No turn yet" line="A turn starts when this player becomes the soul." />
  {:else}
    <div class="fx-feed">
      {#each p.turns as t (`${t.cycle}/${t.turn}`)}
        <a class="li" href={osHref.soul(t.cycle, t.turn)}>
          <span class="txt">
            <span>Round {t.cycle}, turn {t.turn} · <Outcome outcome={t.outcome} /></span>
            <span class="sub">{day(t.started_at)}{#if t.cause} · <q>{t.cause}</q>{/if}{#if t.has_journal && t.outcome !== "playing"} · journal published{/if}</span>
          </span>
          <span class="when num">{t.outcome === "playing" ? "still alive" : life(t.duration_ms)}</span>
        </a>
      {/each}
    </div>
  {/if}
</Window>

<style>
  .os-soul {
    align-items: flex-start;
  }
  .os-tiles {
    flex: 1 1 360px;
    min-width: 0;
  }
  .txt {
    overflow-wrap: anywhere;
  }
</style>
