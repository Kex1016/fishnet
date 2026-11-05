<script lang="ts">
  // Internal: one feed row as a sentence ("Sealily picked up Pufferfish for the 10th time!"), its icon and
  // when. The stat's words come from #lib/format/labels.ts (owner overrides included). Every null has words.
  import type { Kind, MilestoneFeedRow } from "#lib/api/types.ts";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { dateTime, ago, iso } from "#lib/format/dates.ts";
  import { playerLabel } from "#lib/players/names.ts";
  import { rowPhrase, statHref, statLabel, whenOf, whoOf } from "./helpers.ts";
  let {
    m,
    showStat = true,
    showPlayer = true,
    playerName,
    scope
  }: {
    m: MilestoneFeedRow;
    showStat?: boolean;
    /** link the player (false on the player's own page, where the sentence still names them) */
    showPlayer?: boolean;
    /** the player when the rows carry none (a player's own firsts) */
    playerName?: string;
    scope?: string;
  } = $props();
  const who = $derived(whoOf(m));
  const when = $derived(whenOf(m));
  const name = $derived(statLabel(m));
  const phrase = $derived(rowPhrase(m, who ? playerLabel(who.name) : playerName));
  const href = $derived(statHref(m, scope));
  // the stat's link sits on its subject, or on the number when the sentence has no subject ("1st km swum by ...")
  const linkOn = $derived(phrase.parts.some((p) => p.kind === "subject") ? "subject" : "number");
</script>

<li class="fp-ms">
  {#if showStat}<Slot icon={m.icon} kind={(m.kind as Kind | null | undefined) ?? (m.subject === "*" ? "custom" : null)} {name} />{/if}
  <div class="fp-ms__main">
    <!-- one line on purpose: whitespace between the parts would show up inside the sentence ("time !") -->
    <p class="fp-ms__what">{#each phrase.parts as p, i (i)}{#if p.kind === "player"}{#if who && showPlayer}<span class="fp-ms__who"><PlayerName uuid={who.uuid} name={who.name} /></span>{:else}<span class="fp-ms__name" class:t-muted={!who && !playerName}>{p.text}</span>{/if}{:else if p.kind === linkOn && href}<a class="fp-ms__stat" class:fp-ms__thr={p.kind === "number"} {href}>{p.text}</a>{:else if p.kind === "number"}<span class="fp-ms__thr">{p.text}</span>{:else}{p.text}{/if}{/each}</p>
    {#if showPlayer && !phrase.hasPlayer}
      <div class="fp-ms__by">
        {#if who}<PlayerName uuid={who.uuid} name={who.name} />
        {:else}<span class="t-muted">First player unknown</span>{/if}
      </div>
    {/if}
  </div>
  <div class="fp-ms__when">
    {#if when.state === "at"}<time datetime={iso(when.at)} title={dateTime(when.at)}>{ago(when.at)}</time>
    {:else if when.state === "before"}<span class="fp-tag">Reached before tracking began</span>
    {:else}<span class="t-faint">Not reached yet</span>{/if}
  </div>
</li>

<style>
  .fp-ms { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); min-height: 52px; padding: var(--space-2) var(--space-3); border-radius: var(--radius-lg); }
  .fp-ms:not(:has(:global(.fp-slot))) { grid-template-columns: minmax(0, 1fr) auto; }
  .fp-ms:hover { background: var(--raised); }
  .fp-ms__main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .fp-ms__what { margin: 0; font: 400 15px/24px var(--font-text); color: var(--text); overflow-wrap: anywhere; }
  .fp-ms__thr { font: 600 15px/20px var(--font-mono); font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--text); }
  .fp-ms__stat { font-weight: 500; color: var(--text); text-decoration: underline; text-decoration-color: var(--faint); text-underline-offset: 3px; }
  a.fp-ms__stat:hover { color: var(--acc-ink); text-decoration-color: currentColor; }
  .fp-ms__name { font-weight: 500; }
  .fp-ms__who { display: inline-flex; vertical-align: bottom; max-width: 100%; }
  .fp-ms__by { font: 400 13px/20px var(--font-text); min-width: 0; }
  .fp-ms__when { font: 400 12px/16px var(--font-mono); color: var(--faint); text-align: right; max-width: 150px; }
  .fp-ms__when :global(.fp-tag) { height: auto; min-height: 20px; padding-top: 2px; padding-bottom: 2px; white-space: normal; text-align: left; line-height: 14px; }
  @media (max-width: 640px) { .fp-ms__when { max-width: 110px; } }
</style>
