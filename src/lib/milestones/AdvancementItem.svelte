<script lang="ts">
  // Internal: one advancement row. The advancement (title, tab or mod), who completed it first and where, and
  // when. A time that came from the operator's import is tagged, because live tracking did not see it.
  import { Award } from "@lucide/svelte";
  import type { AdvancementRow } from "#lib/api/types.ts";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import { dateTime, ago, iso } from "#lib/format/dates.ts";
  import { titleCase } from "#lib/players/names.ts";
  import { whoOf } from "./helpers.ts";
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
</script>

<li class="fp-ms fp-adv">
  <span class="fp-slot" title={m.advancement}><Award class="fp-ico fp-slot__glyph" strokeWidth={1.4} /></span>
  <div class="fp-ms__main">
    <div class="fp-ms__what">
      <a class="fp-adv__title" href={advHref(m.advancement)}>{title}</a>
      {#if category}<span class="fp-adv__cat">{category}</span>{/if}
    </div>
    <div class="fp-ms__who">
      {#if showPlayer}
        {#if who}<PlayerName uuid={who.uuid} name={who.name} />{:else}<span class="t-muted">First player unknown</span>{/if}
      {/if}
      <span class="fp-adv__meta">
        {#if showServer}{#if showPlayer}{"on "}{/if}<a href="/servers/{encodeURIComponent(m.server)}">{server}</a>{" · "}{/if}{earnersLabel(m.earners)}
      </span>
    </div>
  </div>
  <div class="fp-ms__when">
    <time datetime={iso(m.earned_at)} title={dateTime(m.earned_at)}>{ago(m.earned_at)}</time>
    {#if m.imported}<span class="fp-tag" title="The time comes from the server's world files: this was completed before live tracking began.">Imported</span>{/if}
  </div>
</li>

<style>
  .fp-ms { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); min-height: 52px; padding: var(--space-2) var(--space-3); border-radius: var(--radius-lg); }
  .fp-ms:hover { background: var(--raised); }
  .fp-ms__main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .fp-ms__what { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2); min-width: 0; }
  .fp-adv__title { font: 600 15px/20px var(--font-text); color: var(--text); overflow-wrap: anywhere; }
  .fp-adv__title:hover { color: var(--acc-ink); text-decoration: none; }
  .fp-adv__cat { font: 500 11px/16px var(--font-mono); color: var(--faint); letter-spacing: 0.02em; text-transform: uppercase; }
  .fp-ms__who { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); font: 400 13px/20px var(--font-text); min-width: 0; }
  .fp-adv__meta { color: var(--muted); }
  .fp-adv__meta a { color: inherit; }
  .fp-adv__meta a:hover { color: var(--acc-ink); text-decoration: none; }
  .fp-ms__when { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font: 400 12px/16px var(--font-mono); color: var(--faint); text-align: right; max-width: 150px; }
  @media (max-width: 640px) { .fp-ms__when { max-width: 110px; } }
</style>
