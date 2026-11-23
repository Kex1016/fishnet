<script lang="ts">
  // The player profile (H3, 23 Nov 2026), after the canvas board "Player": who they are, playtime by server,
  // activity, the scope switch, standings, stats, milestone ladders and what they were first to. Everything
  // below the scope bar follows ?scope=. Names, prefixes and suffixes are text (Segments maps colours from an
  // allow-list); nothing from the API is parsed or rendered as markup.
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Face from "#lib/design/Face.svelte";
  import Feed from "#lib/design/Feed.svelte";
  import FeedRow from "#lib/design/FeedRow.svelte";
  import KV from "#lib/design/KV.svelte";
  import KeyValueSheet from "#lib/design/KeyValueSheet.svelte";
  import Ladder from "#lib/design/Ladder.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import PromptLine from "#lib/design/PromptLine.svelte";
  import RankList from "#lib/design/RankList.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import type { RankRow } from "#lib/design/types.ts";
  import { Segments, StatsExplorer, playerLabel, isUuidName, splitMini } from "#lib/players/index.ts";
  import { rowPhrase, statHref, whenOf } from "#lib/milestones/helpers.ts";
  import { advCategory, advHref, advTitle, earnersLabel } from "#lib/milestones/advancements.ts";
  import { day, ago, dateTime, iso } from "#lib/format/dates.ts";
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

  /** playtime lines: servers biggest first, each with its mini-servers under it. A breakdown, never a sum. */
  const lines = $derived.by(() => {
    if (!data.player.ok) return [];
    const pt = data.player.data.playtime;
    const servers = Object.entries(pt.by_server).sort((a, b) => b[1] - a[1]);
    const minis = Object.entries(pt.by_mini).sort((a, b) => b[1] - a[1]);
    const top = Math.max(1, ...servers.map(([, ms]) => ms), ...minis.map(([, ms]) => ms));
    const out: { key: string; label: string; ms: number; share: number; indent: boolean; href?: string }[] = [];
    const used = new Set<string>();
    for (const [s, ms] of servers) {
      out.push({ key: `s:${s}`, label: data.serverNames[s] ?? s, ms, share: ms / top, indent: false, href: `/servers/${encodeURIComponent(s)}` });
      for (const [k, v] of minis) {
        if (splitMini(k)?.server !== s) continue;
        used.add(k);
        out.push({ key: `m:${k}`, label: miniLabel(k), ms: v, share: v / top, indent: true });
      }
    }
    for (const [k, v] of minis) if (!used.has(k)) out.push({ key: `m:${k}`, label: miniLabel(k), ms: v, share: v / top, indent: false });
    return out;
  });
  const plRank = $derived(data.standings.find((s) => s.id === "playtime") ?? null);
  const standingRows = $derived<RankRow[]>(
    data.standings.map((s) => ({
      key: s.id,
      rank: s.rank ?? 0,
      label: s.label,
      href: s.href,
      sub: s.rank !== null ? `of ${group(s.total)}` : s.value > 0 ? `below the top ${s.pageSize}` : "not yet",
      value: s.display
    }))
  );
  const reached = $derived((data.playtimeSteps?.reached ?? 0) + data.ladders.reduce((n: number, l: { view: { reached: number } }) => n + l.view.reached, 0));
  const showLadders = $derived(data.playtimeSteps !== null || data.ladders.length > 0 || data.laddersDown || !data.laddersOff);
  const plural = (n: number, w: string) => `${group(n)} ${w}${n === 1 ? "" : "s"}`;
</script>

{#if !data.player.ok}
  <PageHead cmd="finger" title="player" />
  {#if data.player.kind === "rate_limited"}
    <Notice kind="info"><b>The site is busy.</b> This profile will load again in a moment.</Notice>
  {:else}
    <Notice kind="warning"><b>cakeutils could not be reached.</b> This profile will be back when it is.</Notice>
  {/if}
{:else}
  {@const p = data.player.data}
  {@const name = playerLabel(p.name)}
  <section class="fx-head"><PromptLine path="~/players" cmd="finger" args={name} /></section>

  <Window shell="whoami" path={name}>
    <div class="fx-grid wide idcard">
      <div class="who-main">
        <Face uuid={p.uuid} {name} size="lg" frame={p.online ? "gold" : undefined} />
        <div class="fx-stack">
          <h1 class="who-name" class:c1={isUuidName(p.name)}>
            {#if p.prefix.length}<Segments segments={p.prefix} />{" "}{/if}<span class="who-nm">{name}</span>{#if p.suffix.length}{" "}<Segments segments={p.suffix} />{/if}
          </h1>
          {#if p.online}
            <p class="fx-live">Online{#if p.server}{" on "}<a class="c6" href="/servers/{encodeURIComponent(p.server)}">{data.serverNames[p.server] ?? p.server}</a>{/if}{#if data.currentMini}{" · "}{data.currentMini}{/if}</p>
          {:else}
            <p>Offline. Last seen <time datetime={iso(p.last_seen)} title={dateTime(p.last_seen)}>{ago(p.last_seen)}</time></p>
          {/if}
          <div class="acts">
            {#if data.onMap?.kind === "link"}
              <a class="ink c3" href={data.onMap.href}>show on map</a>
            {:else if data.onMap?.kind === "disabled"}
              <button type="button" class="ink c3" disabled aria-describedby="som-why">show on map</button>
              <span class="c1" id="som-why">{data.onMap.reason}</span>
            {/if}
            <a class="ink flat" href="/players">‹ all players</a>
          </div>
          <p class="cap uuid">{p.uuid}{#if isUuidName(p.name)}{" "}· no name yet: this player was first seen through a stat, before logging in{/if}</p>
          {#if data.player.stale}<p><AsOf at={data.player.asOf} stale /></p>{/if}
        </div>
      </div>
      <KeyValueSheet>
        <KV label="first seen"><time datetime={iso(p.first_seen)} title={dateTime(p.first_seen)}>{day(p.first_seen)}</time></KV>
        <KV label="last seen">{#if p.online}now{:else}<time datetime={iso(p.last_seen)} title={dateTime(p.last_seen)}>{day(p.last_seen)}</time>{/if}</KV>
        <KV label="playtime" num>{durationMs(p.playtime.total_ms)}{#if plRank?.rank != null && data.scope === "network"}{" "}<span class="c3">★{plRank.rank}</span>{/if}</KV>
        <KV label="servers" num>{group(Object.keys(p.playtime.by_server).length)}</KV>
        {#if data.showFirsts && data.firsts.ok}<KV label="firsts" num>{group(data.firsts.data.total)}</KV>{/if}
        {#if data.showFirsts && data.advFirsts.ok}<KV label="advancement firsts" num>{group(data.advFirsts.data.total)}</KV>{/if}
      </KeyValueSheet>
    </div>
  </Window>

  {#snippet playtimeWindow()}
    <Window path="~/players/{name}/playtime">
      <WindowHead title="Playtime" asof="time between servers counts for the network only" />
      <div class="fx-read"><span class="big num">{durationMs(p.playtime.total_ms)}</span><p class="cap">network{#if plRank?.rank != null && data.scope === "network"} · rank {group(plRank.rank)} of {group(plRank.total)}{/if}</p></div>
      {#each lines as l (l.key)}
        <div class="progress" style={l.indent ? "padding-left: 24px" : undefined}>
          <div class="progress_head">
            <span class={l.indent ? "c1" : "c6"}>{l.indent ? "└ " : ""}{#if l.href}<a href={l.href}>{l.label}</a>{:else}{l.label}{/if}</span>
            <span class="progress_num">{durationMs(l.ms)}</span>
          </div>
          <div class="progress_track"><div class="progress_fill" style="width: {Math.max(1, Math.round(l.share * 100))}%"></div></div>
        </div>
      {/each}
      {#if lines.length === 0}<EmptyState title="No time on a server yet" line="Time spent on each server shows up here." />{:else}<p class="cap">A server includes its mini-servers. The lines are a breakdown and do not add up to the network.</p>{/if}
    </Window>
  {/snippet}

  {#if data.activity?.ok}
    {@const a = data.activity.data}
    <div class="fx-grid">
      {@render playtimeWindow()}
      <Window path="~/players/{name}/activity">
        <WindowHead title="Activity" asof="the whole network · UTC days" />
        <div class="stat-panel fx-tiles">
          <div><span class="kv_label">sessions</span><span class="kv_value num">{group(a.sessions)}</span>{#if a.first_session_at}<span class="note">since {day(a.first_session_at)}</span>{/if}</div>
          <div><span class="kv_label">days played</span><span class="kv_value num">{group(a.days_active)}</span></div>
          {#if a.longest_session}<div><span class="kv_label">longest session</span><span class="kv_value num">{durationMs(a.longest_session.ms)}</span><span class="note">{day(a.longest_session.started_at)}{a.longest_session.server ? `, ${data.serverNames[a.longest_session.server] ?? a.longest_session.server}` : ""}</span></div>{/if}
          {#if a.streak}<div><span class="kv_label">best streak</span><span class="kv_value num">{group(a.streak.best_days)}<small>day{a.streak.best_days === 1 ? "" : "s"}</small></span>{#if a.streak.current_days > 0}<span class="note">now on {plural(a.streak.current_days, "day")}</span>{/if}</div>{/if}
        </div>
      </Window>
    </div>
  {:else}
    {@render playtimeWindow()}
  {/if}

  <Window tag="div" path="~/players/{name}/scope" label="Scope">
    <div class="fx-filters">
      <ScopeSwitch url={page.url} scope={data.scope} servers={data.network.ok ? data.network.data.servers : []} minis={data.miniOptions} />
      {#if data.stats.ok}<AsOf at={data.stats.asOf} stale={data.stats.stale} />{/if}
    </div>
  </Window>

  <Window path="~/players/{name}/boards">
    <WindowHead title="Leaderboards" href="/leaderboards" asof="{scopeLabel} · featured boards" />
    {#if data.boardsDown && data.standings.length === 0}
      <Notice kind="warning"><b>cakeutils could not be reached.</b> Standings will be back when it is.</Notice>
    {:else if data.standings.length === 0 && data.composites.length === 0}
      <EmptyState title="No boards yet" line="A featured board appears once anyone has recorded its stat." />
    {:else}
      {#if standingRows.length}<RankList rows={standingRows} compact label="Standings" />{/if}
      {#if data.composites.some((c: { value: unknown }) => c.value)}
        <div class="stat-panel fx-tiles comp">
          {#each data.composites as c (c.id)}{#if c.value}<div><span class="kv_label">{c.label}</span><span class="kv_value num">{c.value.display}</span><span class="note">all distance, {scopeLabel}</span></div>{/if}{/each}
        </div>
      {/if}
      {#if data.boardsDown}<p class="cap">Some boards could not be read right now.</p>{/if}
    {/if}
  </Window>

  <Window path="~/players/{name}/stats">
    <WindowHead title="Stats" asof="{scopeLabel}{data.stats.ok && data.stats.data.total > 0 ? ` · ${plural(data.stats.data.total, 'stat')}` : ''}" />
    <StatsExplorer url={page.url} scope={data.scope} type={data.type} q={data.q} types={data.types} stats={data.stats} limit={data.limit} offset={data.offset} />
  </Window>

  {#if showLadders || data.showFirsts}
    <div class="fx-grid">
      {#if showLadders}
        <Window path="~/players/{name}/milestones">
          <WindowHead title="Milestones" asof={reached > 0 ? `${group(reached)} reached` : undefined} />
          {#if data.scope !== "network" && data.playtimeSteps}<p class="cap pt-note">Playtime is counted on the whole network.</p>{/if}
          {#if data.laddersDown}<Notice kind="warning"><b>cakeutils could not be reached.</b> Some ladders will be back when it is.</Notice>{/if}
          {#if data.playtimeSteps === null && data.ladders.length === 0 && !data.laddersDown}
            <EmptyState title="No ladders for this view" line={data.scope.startsWith("mini:") ? "Milestones have no mini-server view. Try the network or a server." : "Ladders appear once this player has recorded the stats that have them."} />
          {:else}
            <div class="fx-stack">
              {#if data.playtimeSteps}
                <div class="lad"><span>Playtime <span class="c1">· network</span></span><Ladder steps={data.playtimeSteps.steps} label="Playtime thresholds on the network" /></div>
              {/if}
              {#each data.ladders as l (l.id)}
                <div class="lad"><span>{l.label} <span class="c1">· {scopeLabel}</span></span><Ladder steps={l.view.steps} label="{l.label} thresholds" /></div>
              {/each}
            </div>
          {/if}
        </Window>
      {/if}

      {#if data.showFirsts}
        <Window path="~/players/{name}/firsts">
          <WindowHead title="Firsts" asof="first in {scopeLabel === 'network' ? 'the network' : scopeLabel} to" />
          {#if data.firsts.ok || data.firsts.kind !== "off"}
            {#if !data.firsts.ok}
              {#if data.firsts.kind === "down"}<Notice kind="warning"><b>cakeutils could not be reached.</b> The milestones will be back when it is.</Notice>
              {:else if data.firsts.kind === "rate_limited"}<Notice kind="info"><b>The site is busy.</b> The milestones will load again in a moment.</Notice>
              {:else}<EmptyState title="No milestones for this view" line="Try another scope." />{/if}
            {:else}
              {#if data.firsts.stale}<Notice kind="warning"><b>cakeutils could not be reached.</b> Showing the last good data, <AsOf at={data.firsts.asOf} stale />.</Notice>{/if}
              {#if data.firsts.empty}
                <EmptyState title="Not first to anything yet" line="{name} has not been the first to reach a milestone." />
              {:else}
                <Feed label="Milestones this player reached first">
                  {#each data.firsts.data.milestones.slice(0, 10) as m (m.metric + "#" + m.threshold)}
                    {@const w = whenOf(m)}
                    {@const ph = rowPhrase(m, name)}
                    <FeedRow icon={m.icon} href={statHref(m, data.scope) ?? undefined} when={w.state === "at" ? day(w.at) : ""}>
                      {ph.parts.map((x) => x.text).join("")}
                      {#snippet sub()}{#if w.state === "before"}Reached before tracking began{:else if w.state === "none"}Not reached yet{:else}<time datetime={iso(w.at)} title={dateTime(w.at)}>{ago(w.at)}</time>{/if}{/snippet}
                    </FeedRow>
                  {/each}
                </Feed>
                {#if data.firsts.data.total > 10}<p class="cap">The newest 10 of {group(data.firsts.data.total)}.</p>{/if}
              {/if}
            {/if}
          {/if}

          {#if data.advFirsts.ok || data.advFirsts.kind !== "off"}
            <div class="adv">
              <WindowHead title="First to complete" level={3} asof={data.advFirsts.ok && !data.advFirsts.empty ? plural(data.advFirsts.data.total, "first") : undefined} />
              {#if !data.advFirsts.ok}
                {#if data.advFirsts.kind === "down"}<Notice kind="warning"><b>cakeutils could not be reached.</b> The advancements will be back when it is.</Notice>
                {:else if data.advFirsts.kind === "rate_limited"}<Notice kind="info"><b>The site is busy.</b> The advancements will load again in a moment.</Notice>
                {:else}<EmptyState title="No advancements for this view" line="Try the network or a server." />{/if}
              {:else}
                {#if data.advFirsts.stale}<Notice kind="warning"><b>cakeutils could not be reached.</b> Showing the last good data, <AsOf at={data.advFirsts.asOf} stale />.</Notice>{/if}
                {#if data.advFirsts.empty}
                  <EmptyState title="Not first to any advancement yet" line="{name} has not been the first to complete an advancement." />
                {:else}
                  <Feed label="Advancements this player completed first">
                    {#each data.advFirsts.data.milestones.slice(0, 10) as m (m.server + "|" + m.advancement)}
                      {@const cat = advCategory(m.advancement)}
                      <FeedRow icon={m.icon} href={advHref(m.advancement)} when={day(m.earned_at)}>
                        {advTitle(m)}
                        {#snippet sub()}{#if cat}{cat} · {/if}{#if data.scope === "network"}{data.serverNames[m.server] ?? titleCase(m.server)} · {/if}{earnersLabel(m.earners)}{#if m.imported} · imported{/if}{/snippet}
                      </FeedRow>
                    {/each}
                  </Feed>
                  {#if data.advFirsts.data.total > 10}<p class="cap">The newest 10 of {group(data.advFirsts.data.total)}.</p>{/if}
                {/if}
              {/if}
            </div>
          {/if}
          {#if page.data.serversHidden && data.scope === "network"}<p class="cap">Network milestones count play on every server, including servers this site does not list.</p>{/if}
        </Window>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .idcard { align-items: start; }
  .who-main { display: flex; flex-wrap: wrap; gap: var(--space-6); align-items: flex-start; min-width: 0; }
  .who-main > :global(.fx-stack) { flex: 1 1 280px; min-width: 0; }
  .who-name { margin: 0; font-size: 32px; line-height: 1.15; font-weight: 400; overflow-wrap: anywhere; }
  .who-nm { color: var(--color-foam); }
  .acts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); }
  .uuid { overflow-wrap: anywhere; margin: 0; }
  .lad { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
  .pt-note { margin: 0 0 var(--space-3); }
  .comp { margin-top: var(--space-4); }
  .adv { margin-top: var(--space-6); }
</style>
