<script lang="ts">
  // Internal: one advancement row. The advancement (its picture, title, tab or mod), who completed it first and
  // where, and when. A time that came from the operator's import is tagged, because live tracking did not see it.
  import type { AdvancementRow } from "#lib/api/types.ts";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import { iconHref } from "#lib/images.ts";
  import { titleCase } from "#lib/players/names.ts";
  import { whoOf } from "./helpers.ts";
  import When from "./When.svelte";
  import { advCategory, advHref, advTitle, earnersLabel } from "./advancements.ts";
  let {
    m,
    showPlayer = true,
    showServer = true,
    serverNames = {}
  }: { m: AdvancementRow; showPlayer?: boolean; showServer?: boolean; serverNames?: Record<string, string> } = $props();
  const who = $derived(whoOf(m));
  const title = $derived(advTitle(m));
  const category = $derived(advCategory(m.advancement));
  const server = $derived(serverNames[m.server] ?? titleCase(m.server));
  const src = $derived(iconHref(m.icon));
</script>

<div class="li">
  <span class="pic" title={title}>{#if src}<img {src} alt="" width="20" height="20" loading="lazy" decoding="async" />{/if}</span>
  <span class="txt">
    <span><a href={advHref(m.advancement)}>{title}</a>{#if category}{" "}<span class="c1 cat">{category}</span>{/if}</span>
    <span class="sub">
      {#if showPlayer}{#if who}<PlayerName uuid={who.uuid} name={who.name} />{:else}First player unknown{/if}{" · "}{/if}{#if showServer}{#if showPlayer}{"on "}{/if}<a href="/servers/{encodeURIComponent(m.server)}">{server}</a>{" · "}{/if}{earnersLabel(m.earners)}
    </span>
  </span>
  <When when={{ state: "at", at: m.earned_at }} imported={m.imported} />
</div>

<style>
  .cat { font-size: 12px; }
</style>
