<script lang="ts">
  // The stats explorer on a profile (PLAN §3.4): every stat the player has in the chosen scope, by
  // type, with the catalogue's icons and names, a search box and links to each stat's board.
  // "All" shows the biggest few of every type; one type shows all of its rows, biggest first, paged.
  // Values are never compared across units (a custom type keeps each unit together, explore.ts), and a bar is
  // the share of the biggest row of the same unit in the same list: inside one scope, never across scopes.
  // Props `url`, `scope`, `type`, `q`, `types`, `stats` are the ones W0 froze; the rest are optional.
  import type { StatList, StatTypes, StatValue } from "#lib/api/types.ts";
  import type { Result } from "#lib/api/result.ts";
  import type { Scope } from "#lib/api/scope.ts";
  import { boardHref } from "#lib/api/metric.ts";
  import { withParams, type UrlLike } from "#lib/url.ts";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Pager from "#lib/design/Pager.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
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
  const at = (t: string | null) => withParams(url, { type: t, offset: null });
  const options = $derived([
    { href: at(null), label: "all", current: type === null },
    ...(catalogue ?? []).map((t) => ({ href: at(t.key), label: typeName(catalogue, t.key).toLowerCase(), current: t.key === type })),
    ...(type && !(catalogue ?? []).some((t) => t.key === type) ? [{ label: typeName(catalogue, type).toLowerCase(), current: true }] : [])
  ]);
  const href = (s: { type: string; subject: string }) => boardHref({ kind: "stat", type: s.type, subject: s.subject }, scope);
  /** the biggest value per unit in a list that is already biggest first inside each unit */
  const maxOf = (list: StatValue[]) => {
    const m = new Map<string, number>();
    for (const s of list) if (!m.has(s.unit)) m.set(s.unit, s.value);
    return m;
  };
  const share = (s: StatValue, m: Map<string, number>) => {
    const top = m.get(s.unit) ?? 0;
    return top > 0 ? Math.max(0.02, Math.min(1, s.value / top)) : 0;
  };
</script>

<div class="sx">
  <div class="fx-filters">
    <Segmented label="Stat type" {options} />
    <form class="find" method="get" action={url.pathname} role="search">
      {#if scope !== "network"}<input type="hidden" name="scope" value={scope} />{/if}
      {#if type}<input type="hidden" name="type" value={type} />{/if}
      <label class="fx-search"><span class="c4" aria-hidden="true">»</span><input type="search" name="q" value={q} placeholder="find a stat" aria-label="Find a stat" maxlength="64" autocomplete="off" /></label>
      <button class="ink c5" type="submit">search</button>
      {#if q}<a class="ink flat" href={withParams(url, { q: null, offset: null })}>clear</a>{/if}
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
    {@const m = maxOf(single.stats)}
    <section>
      <WindowHead title={single.name} level={3} asof="{group(single.total)} stat{single.total === 1 ? '' : 's'}" />
      <div class="fx-rank sx-rows" aria-label={single.name}>
        {#each pageRows as s (s.type + "|" + s.subject)}
          <a class="row" href={href(s)} title="Leaderboard: {subjectName(s.name, s.subject)}">
            <Slot icon={s.icon} name={subjectName(s.name, s.subject)} />
            <span class="who">{subjectName(s.name, s.subject)}<span class="sub">{s.subject}</span></span>
            <span class="bar"><i style="width: {Math.round(share(s, m) * 1000) / 10}%"></i></span>
            <span class="val">{s.display}</span>
          </a>
        {/each}
      </div>
      <Pager {url} total={single.total} {limit} {offset} what="stats" />
    </section>
  {:else}
    <div class="fx-grid">
      {#each groups as g (g.type)}
        {@const m = maxOf(g.stats)}
        <section>
          <WindowHead title={g.name} level={3} href={at(g.type)} asof="{group(g.total)} stat{g.total === 1 ? '' : 's'}" />
          <div class="fx-rank sx-rows" aria-label={g.name}>
            {#each g.stats as s (s.type + "|" + s.subject)}
              <a class="row" href={href(s)} title="Leaderboard: {subjectName(s.name, s.subject)}">
                <Slot icon={s.icon} name={subjectName(s.name, s.subject)} />
                <span class="who">{subjectName(s.name, s.subject)}</span>
                <span class="bar"><i style="width: {Math.round(share(s, m) * 1000) / 10}%"></i></span>
                <span class="val">{s.display}</span>
              </a>
            {/each}
          </div>
          {#if g.total > g.stats.length}<p class="more"><a class="c6" href={at(g.type)}>all {group(g.total)} ›</a></p>{/if}
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sx { display: flex; flex-direction: column; gap: var(--space-4); }
  .find { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-left: auto; }
  .more { margin: var(--space-2) 0 0; font-size: 14px; }
  .fx-rank.sx-rows .row { grid-template-columns: 36px minmax(0, 1fr) minmax(0, 1.2fr) 12ch; }
  @media (max-width: 720px) {
    .find { margin-left: 0; width: 100%; }
    .find .fx-search { flex: 1; }
    .fx-rank.sx-rows .row { grid-template-columns: 36px minmax(0, 1fr) auto; }
  }
</style>
