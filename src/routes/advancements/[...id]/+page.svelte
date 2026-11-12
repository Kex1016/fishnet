<script lang="ts">
  import { Award } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import { ago, dateTime, iso } from "#lib/format/dates.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { titleCase } from "#lib/players/names.ts";
  let { data } = $props();
  /** "minecraft:cherry_grove" → "Cherry grove"; free-form criteria stay as the game names them */
  const critLabel = (c: string) => {
    const t = (c.includes(":") ? c.slice(c.indexOf(":") + 1) : c).replace(/[_/]+/g, " ").trim();
    return t ? t[0].toUpperCase() + t.slice(1) : c;
  };
  const serverName = (id: string) => data.serverNames[id] ?? titleCase(id);
  const players = (n: number) => `${group(n)} player${n === 1 ? "" : "s"}`;
</script>

<div class="fp-page">
  <header class="fp-hero fp-adv-hero">
    <span class="fp-slot fp-slot--lg"><Award class="fp-ico fp-slot__glyph" strokeWidth={1.4} /></span>
    <div class="fp-adv-hero__text">
      {#if data.category}<span class="t-kicker">{data.category}</span>{/if}
      <h1 class="t-display">{data.title}</h1>
      <span class="t-caption t-faint fp-adv-hero__id">{data.id}</span>
      <p class="fp-chips"><a class="fp-chip" href="/advancements">All advancements</a></p>
    </div>
  </header>

  {#if !data.detail.ok}
    {#if data.detail.kind === "not_found"}
      <EmptyState title="Nobody has completed this yet" line="It shows up here once a player completes it on a server." />
    {:else if data.detail.kind === "rate_limited"}
      <Notice kind="info"><b>The site is busy.</b> This advancement will load again in a moment{#if data.detail.retryAfter}, in about {data.detail.retryAfter} s{/if}.</Notice>
    {:else}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> This advancement will be back when it is. {#if data.detail.asOf}<AsOf at={data.detail.asOf} stale />{/if}</Notice>
    {/if}
  {:else}
    {@const d = data.detail.data}
    {#if data.detail.stale}<Notice kind="warning"><b>cakeutils could not be reached.</b> Showing the last good data, <AsOf at={data.detail.asOf} stale />.</Notice>{/if}

    <section class="fp-section">
      <div class="fp-section__head"><h2 class="t-title-2">First in the network</h2><span class="t-caption t-faint">the earliest completion on any server</span></div>
      {#if !d.network}
        <EmptyState title="Nobody has completed this yet" line="It shows up here once a player completes it on a server." />
      {:else}
        {@const n = d.network}
        <div class="fp-adv-first">
          <div class="fp-adv-first__who">
            {#if n.uuid && n.name}<PlayerName uuid={n.uuid} name={n.name} size="md" />{:else}<span class="t-muted">First player unknown</span>{/if}
          </div>
          <div class="fp-adv-first__meta t-small t-muted">
            <span>on <a href="/servers/{encodeURIComponent(n.server)}">{serverName(n.server)}</a>,</span>
            <time datetime={iso(n.earned_at)} title={dateTime(n.earned_at)}>{ago(n.earned_at)}</time>
            {#if n.imported}<span class="fp-tag" title="The time comes from the server's world files: this was completed before live tracking began.">Imported</span>{/if}
          </div>
          <div class="fp-adv-first__count t-small">{players(n.earners)} {n.earners === 1 ? "has" : "have"} it across the network.</div>
        </div>
      {/if}
    </section>

    <section class="fp-section">
      <div class="fp-section__head"><h2 class="t-title-2">By server</h2><span class="t-caption t-faint">each server on its own; a player with it on two servers counts on both</span></div>
      {#if d.servers.length === 0}
        <EmptyState title="No server has this yet" />
      {:else}
        <div class="fp-table__wrap">
          <table class="fp-table">
            <thead><tr><th>Server</th><th>First</th><th>When</th><th class="num">Players with it</th></tr></thead>
            <tbody>
              {#each d.servers as s (s.server)}
                <tr>
                  <td><a href="/servers/{encodeURIComponent(s.server)}">{serverName(s.server)}</a></td>
                  <td>{#if s.uuid && s.name}<PlayerName uuid={s.uuid} name={s.name} />{:else}<span class="t-muted">First player unknown</span>{/if}</td>
                  <td class="fp-adv-when">
                    <time datetime={iso(s.earned_at)} title={dateTime(s.earned_at)}>{ago(s.earned_at)}</time>
                    {#if s.imported}<span class="fp-tag" title="The time comes from the server's world files: this was completed before live tracking began.">Imported</span>{/if}
                  </td>
                  <td class="num">{group(s.earners)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    {#if data.criteria && data.criteria.length}
      <section class="fp-section">
        <div class="fp-section__head"><h2 class="t-title-2">First to each part</h2><span class="t-caption t-faint">the network; each criterion on its own</span></div>
        <div class="fp-table__wrap">
          <table class="fp-table">
            <thead><tr><th>Part</th><th>First</th><th>When</th><th class="num">Players with it</th></tr></thead>
            <tbody>
              {#each data.criteria as c (c.criterion)}
                <tr>
                  <td>{critLabel(c.criterion)}</td>
                  <td><PlayerName uuid={c.uuid} name={c.name} /></td>
                  <td class="fp-adv-when">{#if c.earned_at}<time datetime={iso(c.earned_at)} title={dateTime(c.earned_at)}>{ago(c.earned_at)}</time>{:else}<span class="t-muted">before tracking began</span>{/if}{#if c.imported}<span class="fp-tag">Imported</span>{/if}</td>
                  <td class="num">{c.earners === undefined ? "–" : group(c.earners)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .fp-adv-hero { flex-direction: row; align-items: center; gap: var(--space-4); }
  .fp-adv-hero__text { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .fp-adv-hero__id { font-family: var(--font-mono); overflow-wrap: anywhere; }
  .fp-adv-first { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--surface); border: 1px solid var(--line-soft); }
  .fp-adv-first__who { font: 600 18px/24px var(--font-text); }
  .fp-adv-first__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); }
  .fp-adv-first__meta time { font-family: var(--font-mono); }
  .fp-adv-when { white-space: nowrap; }
  .fp-adv-when time { font-family: var(--font-mono); font-size: 12px; color: var(--faint); margin-right: var(--space-2); }
</style>
