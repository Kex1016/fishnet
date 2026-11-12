<script lang="ts">
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import { StatTile } from "#lib/charts/index.ts";
  import { Segments, StatsExplorer, playerLabel, isUuidName, splitMini } from "#lib/players/index.ts";
  import { PlayerAdvancementFirsts, PlayerFirsts } from "#lib/milestones/index.ts";
  import HiddenServersNote from "#lib/milestones/HiddenServersNote.svelte";
  import { day, ago, dateTime } from "#lib/format/dates.ts";
  import { durationMs, group } from "#lib/format/stat-display.ts";
  import { titleCase } from "#lib/players/names.ts";
  let { data } = $props();
  const scopeLabel = $derived.by(() => {
    if (data.scope === "network") return "network";
    if (data.scope.startsWith("server:")) return data.serverNames[data.scope.slice(7)] ?? data.scope.slice(7);
    const m = splitMini(data.scope.slice(5));
    return (m && data.miniNames[`${m.server}/${m.mini}`]) ?? data.scope.slice(5);
  });
  const miniLabel = (key: string) => {
    if (data.miniNames[key]) return data.miniNames[key];
    const m = splitMini(key);
    return m ? `${titleCase(m.mini)} · ${data.serverNames[m.server] ?? m.server}` : key;
  };
</script>

<div class="fp-page">
  {#if !data.player.ok}
    {#if data.player.kind === "rate_limited"}
      <Notice kind="warning"><b>Too many requests to cakeutils.</b> This profile will be back in a moment.</Notice>
    {:else}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> This profile will be back when it is.</Notice>
    {/if}
  {:else}
    {@const p = data.player.data}
    <header class="fp-who">
      <Face uuid={p.uuid} name={playerLabel(p.name)} size="lg" />
      <div class="fp-who__text">
        <h1 class="t-display fp-who__name">
          {#if p.prefix.length}<span class="fp-who__affix"><Segments segments={p.prefix} /></span>{/if}<span class:t-muted={isUuidName(p.name)}>{playerLabel(p.name)}</span>{#if p.suffix.length}<span class="fp-who__affix"><Segments segments={p.suffix} /></span>{/if}
        </h1>
        <p class="fp-who__status t-small t-muted">
          {#if p.online}
            <span class="fp-dot fp-dot--on" aria-hidden="true"></span> Online{#if p.server}{" on "}<a href="/servers/{encodeURIComponent(p.server)}">{data.serverNames[p.server] ?? p.server}</a>{/if}{#if data.currentMini}{" · "}{data.currentMini}{/if}
          {:else}
            Last seen <time datetime={new Date(p.last_seen).toISOString()} title={dateTime(p.last_seen)}>{ago(p.last_seen)}</time>
          {/if}
          · first seen <time datetime={new Date(p.first_seen).toISOString()} title={dateTime(p.first_seen)}>{day(p.first_seen)}</time>
        </p>
        <p class="t-caption t-faint fp-who__uuid">{p.uuid}{#if isUuidName(p.name)} · no name yet: this player was first seen through a stat, before logging in{/if}</p>
      </div>
      {#if data.player.stale}<AsOf at={data.player.asOf} stale />{/if}
    </header>

    <section class="fp-section">
      <div class="fp-section__head"><h2 class="t-title-2">Playtime</h2><span class="t-caption t-faint">time between servers counts for the network only</span></div>
      <div class="fp-tiles">
        <StatTile label="Network" value={durationMs(p.playtime.total_ms)} note="live" />
        {#each Object.entries(p.playtime.by_server) as [s, ms] (s)}
          <StatTile label={data.serverNames[s] ?? s} value={durationMs(ms)} note="server" href="/servers/{encodeURIComponent(s)}" />
        {/each}
        {#each Object.entries(p.playtime.by_mini) as [m, ms] (m)}
          <StatTile label={miniLabel(m)} value={durationMs(ms)} note="mini-server" />
        {/each}
      </div>
    </section>

    {#if data.activity?.ok}
      {@const a = data.activity.data}
      <section class="fp-section">
        <div class="fp-section__head"><h2 class="t-title-2">Activity</h2><span class="t-caption t-faint">the whole network, UTC days</span></div>
        <div class="fp-tiles">
          <StatTile label="Sessions" value={group(a.sessions)} note={a.first_session_at ? `since ${day(a.first_session_at)}` : undefined} />
          <StatTile label="Days played" value={group(a.days_active)} />
          {#if a.longest_session}<StatTile label="Longest session" value={durationMs(a.longest_session.ms)} note={`${day(a.longest_session.started_at)}${a.longest_session.server ? `, ${data.serverNames[a.longest_session.server] ?? a.longest_session.server}` : ""}`} />{/if}
          {#if a.streak}<StatTile label="Best streak" value={`${a.streak.best_days} day${a.streak.best_days === 1 ? "" : "s"}`} note={a.streak.current_days > 0 ? `now on ${a.streak.current_days} day${a.streak.current_days === 1 ? "" : "s"}` : undefined} />{/if}
        </div>
        {#if a.playtime_milestones.length}
          <ul class="fp-pt-miles">
            {#each a.playtime_milestones as m (m.threshold_ms)}
              <li class="fp-tag {m.first ? 'fp-tag--acc' : ''}">{m.display}{m.reached_at ? `, ${day(m.reached_at)}` : ", before tracking began"}{#if m.first} · first on the network{/if}</li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <div class="fp-filters fp-scopebar">
      <span class="t-kicker">Scope</span>
      <ScopeSwitch url={page.url} scope={data.scope} servers={data.network.ok ? data.network.data.servers : []} minis={data.miniOptions} />
      {#if data.stats.ok}<AsOf at={data.stats.asOf} stale={data.stats.stale} />{/if}
    </div>

    <section class="fp-section">
      <div class="fp-section__head">
        <h2 class="t-title-2"><a href="/leaderboards">Leaderboards</a></h2>
        <span class="t-caption t-faint">{scopeLabel} · featured boards</span>
      </div>
      {#if data.boardsDown && data.standings.length === 0}
        <Notice kind="warning"><b>cakeutils could not be reached.</b> Standings will be back when it is.</Notice>
      {:else if data.standings.length === 0 && data.composites.length === 0}
        <EmptyState title="No boards yet" line="A featured board appears once anyone has recorded its stat." />
      {:else}
        <ul class="fp-rows fp-standings">
          {#each data.standings as s (s.id)}
            <li>
              <a class="fp-row fp-standing" href={s.href} title="{s.label} leaderboard">
                <span class="fp-row__rank" class:fp-row__rank--top={s.rank !== null && s.rank <= 3}>{#if s.rank !== null}#{s.rank}{:else}—{/if}</span>
                <span class="fp-row__name">{s.label} <span class="fp-row__sub">{#if s.rank !== null}of {group(s.total)}{:else if s.value > 0}below the top {s.pageSize}{:else}not yet{/if}</span></span>
                <span class="fp-row__value">{s.display}</span>
              </a>
            </li>
          {/each}
          {#each data.composites as c (c.id)}
            {#if c.value}
              <li>
                <span class="fp-row fp-standing">
                  <span class="fp-row__rank" aria-hidden="true"></span>
                  <span class="fp-row__name">{c.label} <span class="fp-row__sub">all distance</span></span>
                  <span class="fp-row__value">{c.value.display}</span>
                </span>
              </li>
            {/if}
          {/each}
        </ul>
        {#if data.boardsDown}<p class="t-caption t-faint">Some boards could not be read right now.</p>{/if}
      {/if}
    </section>

    <section class="fp-section">
      <div class="fp-section__head">
        <h2 class="t-title-2">Stats</h2>
        <span class="t-caption t-faint">{scopeLabel}{#if data.stats.ok && data.stats.data.total > 0}{" · "}{group(data.stats.data.total)} stat{data.stats.data.total === 1 ? "" : "s"}{/if}</span>
      </div>
      <StatsExplorer url={page.url} scope={data.scope} type={data.type} q={data.q} types={data.types} stats={data.stats} limit={data.limit} offset={data.offset} />
    </section>

    {#if data.showFirsts}
      <PlayerFirsts result={data.firsts} playerName={playerLabel(p.name)} />
      <HiddenServersNote scope={data.scope} />
      <PlayerAdvancementFirsts result={data.advFirsts} playerName={playerLabel(p.name)} serverNames={data.serverNames} showServer={data.scope === "network"} />
    {/if}
  {/if}
</div>

<style>
  .fp-pt-miles {
    list-style: none;
    margin: var(--space-3) 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .fp-who { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: var(--space-2) var(--space-5); align-items: center; }
  .fp-who__text { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  .fp-who__name { overflow-wrap: anywhere; }
  .fp-who__affix { font-weight: 500; }
  .fp-who__status { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); }
  .fp-who__uuid { font-family: var(--font-mono); overflow-wrap: anywhere; }
  .fp-scopebar { gap: var(--space-3); }
  .fp-scopebar :global(.fp-seg) { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
  .fp-standings { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); gap: var(--space-1) var(--space-4); }
  .fp-standing { grid-template-columns: 40px minmax(0, 1fr) auto; border: 1px solid var(--line-soft); background: var(--surface); }
  a.fp-standing:hover { border-color: var(--line); }
  @media (max-width: 640px) { .fp-who { grid-template-columns: 48px minmax(0, 1fr); } .fp-who :global(.fp-face--lg) { width: 48px; height: 48px; } }
</style>
