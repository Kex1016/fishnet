<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import { osHref } from "#lib/onesoul/links.ts";
  import { day } from "#lib/format/dates.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const reg = $derived(data.reg);
  const played = $derived(data.players.filter((p) => p.played).length);
</script>

<PageHead
  path="~/one-soul"
  cmd="cat"
  args="sign-ups.txt"
  title="sign-ups"
  lede="Everyone who signed up, by name. The order of turns is drawn in secret and is not shown anywhere, not even by sign-up time."
  note={reg?.ok ? `round ${reg.data.round}` : undefined}
>
  <OsTabs />
  {#if data.rounds.length > 1}
    <div class="fx-filters">
      <Segmented label="Round" options={data.rounds.map((r: number) => ({ href: withParams(page.url, { round: String(r) }), label: `round ${r}`, current: reg?.ok === true && r === reg.data.round }))} />
    </div>
  {/if}
</PageHead>

{#if !reg || !reg.ok}
  <Notice kind="warning">Sign-ups could not be loaded right now.</Notice>
{:else if data.players.length === 0}
  <EmptyState title="Nobody has signed up yet" line="Sign up in game with /onesoul join." />
{:else}
  <Window path="~/one-soul/sign-ups" args="--round {reg.data.round}">
    <WindowHead title="Signed up"><span class="num">{reg.data.total}</span> signed up, <span class="num">{played}</span> had their turn · <AsOf at={reg.asOf} stale={reg.stale} /></WindowHead>
    <ul class="fx-cat os-wall">
      {#each data.players as p (p.uuid)}
        <li>
          <a href={osHref.player(p.uuid)}>
            <span class="os-who"><Face uuid={p.uuid} name={p.name} size="sm" /><span class="os-name">{p.name}</span></span>
            <span class="meta c1">{p.played ? "played" : `since ${day(p.registered_at)}`}</span>
          </a>
        </li>
      {/each}
    </ul>
  </Window>
{/if}

<style>
  .os-wall {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .os-wall li {
    display: contents;
  }
  .os-who {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .os-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    flex: none;
    font-size: 12px;
  }
</style>
