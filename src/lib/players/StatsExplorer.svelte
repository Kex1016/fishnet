<script lang="ts">
  // The stats explorer on a profile (PLAN §3.4): every stat the player has in the chosen scope, by
  // type, with the catalogue's icons and names, a search box and links to each stat's board.
  // "All" shows the biggest few of every type; one type shows all of its rows, biggest first, paged.
  // Values are never compared across units (a custom type keeps each unit together, explore.ts).
  // Props `url`, `scope`, `type`, `q`, `types`, `stats` are the ones W0 froze; the rest are optional.
  import type { Kind, StatList, StatTypes } from "#lib/api/types.ts";
  import type { Result } from "#lib/api/result.ts";
  import type { Scope } from "#lib/api/scope.ts";
  import { boardHref } from "#lib/api/metric.ts";
  import { withParams, type UrlLike } from "#lib/url.ts";
  import { Search } from "@lucide/svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { group } from "#lib/format/stat-display.ts";
  import { groupByType, kindOf } from "./explore.ts";
  import { subjectName, typeName } from "./names.ts";
  let {
    url,
    scope,
    type,
    q,
    types,
    stats,
    perType = 6,
    limit = 60,
    offset = 0
  }: {
    url: UrlLike;
    scope: Scope;
    /** the selected type key or null for all */
    type: string | null;
    q: string;
    types: Result<StatTypes>;
    stats: Result<StatList>;
    /** rows per type in the "All" view */
    perType?: number;
    /** page size in a type's view */
    limit?: number;
    offset?: number;
  } = $props();

  const catalogue = $derived(types.ok ? types.data.types : undefined);
  const rows = $derived(stats.ok ? stats.data.stats : []);
  const groups = $derived(type ? groupByType(rows, catalogue) : groupByType(rows, catalogue, perType));
  /** in a type's view: that one group, paged */
  const single = $derived(type ? (groups[0] ?? { type, name: typeName(catalogue, type), kind: kindOf(catalogue, type), stats: [], total: 0 }) : null);
  const pageRows = $derived(single ? single.stats.slice(offset, offset + limit) : []);
  const chips = $derived([{ key: null as string | null, label: "All" }, ...(catalogue ?? []).map((t) => ({ key: t.key as string | null, label: typeName(catalogue, t.key) }))]);
  const at = (t: string | null) => withParams(url, { type: t, offset: null });
  const kindFor = (t: string): Kind | null => kindOf(catalogue, t) as Kind | null;
  const href = (s: { type: string; subject: string }) => boardHref({ kind: "stat", type: s.type, subject: s.subject }, scope);
</script>

<div class="fp-explorer">
  <div class="fp-filters">
    <nav class="fp-chips" aria-label="Stat type">
      {#each chips as ch (ch.key ?? "")}
        <a class="fp-chip" href={at(ch.key)} aria-current={ch.key === type ? "true" : undefined}>{ch.label}</a>
      {/each}
      {#if type && !chips.some((ch) => ch.key === type)}<span class="fp-chip" aria-current="true">{typeName(catalogue, type)}</span>{/if}
    </nav>
    <form class="fp-explorer__search" method="get" action={url.pathname} role="search">
      {#if scope !== "network"}<input type="hidden" name="scope" value={scope} />{/if}
      {#if type}<input type="hidden" name="type" value={type} />{/if}
      <label class="fp-field fp-search">
        <Search class="fp-ico fp-ico--sm" strokeWidth={1.4} />
        <input type="search" name="q" value={q} placeholder="Find a stat" aria-label="Find a stat" maxlength="64" autocomplete="off" />
      </label>
      <button class="fp-btn" type="submit">Search</button>
      {#if q}<a class="fp-btn fp-btn--quiet" href={withParams(url, { q: null, offset: null })}>Clear</a>{/if}
    </form>
  </div>

  {#if !stats.ok}
    {#if stats.kind === "down" || stats.kind === "rate_limited"}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> Stats will be back when it is.</Notice>
    {:else if stats.kind === "bad_request"}
      <EmptyState title="Nothing to show for this scope" line="Pick a scope from the switch above." />
    {:else}
      <EmptyState title="No stats yet" />
    {/if}
  {:else if rows.length === 0}
    {#if q}
      <EmptyState title="No stat matches" line="Names and keys match on any part, so a few letters are enough." />
    {:else if type}
      <EmptyState title="Nothing in {typeName(catalogue, type)} yet" line="This player has not recorded this kind of stat in this scope." />
    {:else}
      <EmptyState title="No stats here yet" line="This player has not recorded anything in this scope." />
    {/if}
  {:else if single}
    <section class="fp-section">
      <div class="fp-section__head">
        <h3 class="t-title-4">{single.name} <span class="t-caption t-faint">{group(single.total)} stat{single.total === 1 ? "" : "s"}</span></h3>
      </div>
      <ul class="fp-rows">
        {#each pageRows as s (s.type + "|" + s.subject)}
          <li>
            <a class="fp-row fp-explorer__row" href={href(s)} title="Leaderboard: {subjectName(s.name, s.subject)}">
              <Slot icon={s.icon} kind={kindFor(s.type)} name={subjectName(s.name, s.subject)} />
              <span class="fp-row__name">{subjectName(s.name, s.subject)} <span class="fp-row__sub">{s.subject}</span></span>
              <span class="fp-row__value">{s.display}</span>
            </a>
          </li>
        {/each}
      </ul>
      <Pager {url} total={single.total} {limit} {offset} what="stats" />
    </section>
  {:else}
    <div class="fp-explorer__groups">
      {#each groups as g (g.type)}
        <section class="fp-section fp-explorer__group">
          <div class="fp-section__head">
            <h3 class="t-title-4"><a href={at(g.type)}>{g.name}</a> <span class="t-caption t-faint">{group(g.total)} stat{g.total === 1 ? "" : "s"}</span></h3>
            {#if g.total > g.stats.length}<a class="t-small" href={at(g.type)}>All {group(g.total)}</a>{/if}
          </div>
          <ul class="fp-rows">
            {#each g.stats as s (s.type + "|" + s.subject)}
              <li>
                <a class="fp-row fp-explorer__row" href={href(s)} title="Leaderboard: {subjectName(s.name, s.subject)}">
                  <Slot icon={s.icon} kind={kindFor(s.type)} name={subjectName(s.name, s.subject)} />
                  <span class="fp-row__name">{subjectName(s.name, s.subject)}</span>
                  <span class="fp-row__value">{s.display}</span>
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .fp-explorer { display: flex; flex-direction: column; gap: var(--space-4); }
  .fp-explorer__search { display: flex; align-items: center; gap: var(--space-2); margin-left: auto; }
  .fp-explorer__row { grid-template-columns: 36px minmax(0, 1fr) auto; }
  .fp-explorer__groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr)); gap: var(--space-5) var(--space-6); align-items: start; }
  .fp-explorer__group { padding: var(--space-4); border: 1px solid var(--line-soft); border-radius: var(--radius-xl); background: var(--surface); }
  .fp-rows { list-style: none; margin: 0; padding: 0; }
  @media (max-width: 640px) { .fp-explorer__search { margin-left: 0; width: 100%; } .fp-explorer__search .fp-search { flex: 1; width: auto; } }
</style>
