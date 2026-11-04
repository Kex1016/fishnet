<script lang="ts">
  import { page } from "$app/state";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { MilestoneLadder } from "#lib/milestones/index.ts";
  import { boardHref } from "#lib/api/metric.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { withParams } from "#lib/url.ts";
  import { playerHref, playerLabel } from "../../../leaderboards/board.ts";
  let { data } = $props();
  const showLadder = $derived(data.ladder !== null && !(!data.ladder.ok && data.ladder.kind === "off"));
</script>

<div class="fp-page">
  {#if !data.subject.ok}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> This subject will be back when it is.</Notice>
  {:else}
    {@const s = data.subject.data}
    <header class="fp-hero" style="flex-direction: row; align-items: center; gap: var(--space-4)">
      <Slot icon={s.names[0]?.icon} kind={s.names[0]?.kind as never} size="lg" name={data.label} />
      <div style="display: flex; flex-direction: column; gap: var(--space-2); min-width: 0">
        <span class="t-kicker">{data.key}</span>
        <h1 class="t-display">{data.label}</h1>
        {#if s.names.length > 1}
          <p class="t-small t-muted">Also known as {s.names.map((n) => `${n.name ?? "?"} (${n.kind ?? "other"})`).join(", ")}</p>
        {/if}
        <p class="fp-chips"><a class="fp-chip" href="/stats">All stats</a></p>
      </div>
    </header>

    {#if s.types.length === 0}
      <EmptyState title="Nobody has done this yet" line="{data.label} is in the catalogue, but no one has recorded it." />
    {:else}
      <div class="fp-filters">
        {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} minis={data.minis} />{/if}
      </div>

      <section class="fp-section">
        <div class="fp-section__head"><h2 class="t-title-3">Boards</h2><span class="t-caption">{data.scopeName}</span></div>
        <div class="fp-table__wrap fp-card">
          <table class="fp-table">
            <caption class="visually-hidden">Boards for {data.label} in {data.scopeName}</caption>
            <thead><tr><th scope="col">Type</th><th scope="col">In the lead</th><th class="num" scope="col">Value</th><th class="num" scope="col">Players</th></tr></thead>
            <tbody>
              {#each data.boards as b (b.type)}
                <tr>
                  <td><a href={boardHref({ kind: "stat", type: b.type, subject: data.key }, data.scope)}>{b.typeName}</a></td>
                  {#if b.result.ok && b.result.leader}
                    <td><a class="lead" href={playerHref(b.result.leader)}><Face uuid={b.result.leader.uuid} name={playerLabel(b.result.leader)} size="sm" /><span>{playerLabel(b.result.leader)}</span></a></td>
                    <td class="num">{b.result.leader.display}</td>
                    <td class="num">{group(b.result.total)}</td>
                  {:else if b.result.ok}
                    <td colspan="3" class="t-muted">No one in {data.scopeName} has recorded this yet</td>
                  {:else}
                    <td colspan="3" class="t-muted">Could not be loaded right now</td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      {#if showLadder}
        <section class="fp-section">
          <div class="fp-section__head"><h2 class="t-title-3">Milestones</h2>{#if data.firstTypeName}<span class="t-caption">{data.firstTypeName} · {data.scopeName}</span>{/if}</div>
          {#if s.types.length > 1}
            <nav class="fp-chips" aria-label="Milestones for which type">
              {#each data.boards as b (b.type)}
                <a class="fp-chip" href={withParams(page.url, { type: b.type })} aria-current={b.type === data.firstType ? "true" : undefined}>{b.typeName}</a>
              {/each}
            </nav>
          {/if}
          {#if data.ladder}<MilestoneLadder result={data.ladder} statName={data.label} />{/if}
        </section>
      {:else if data.miniScope}
        <p class="t-small t-muted">Milestones are kept per server and for the whole network, not per mini-server.</p>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .lead { display: inline-flex; align-items: center; gap: var(--space-2); color: inherit; font-weight: 500; min-width: 0; }
  .lead:hover { color: var(--acc-ink); text-decoration: none; }
</style>
