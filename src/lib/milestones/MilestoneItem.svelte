<script lang="ts">
  // Internal: one feed row as a sentence ("Sealily picked up Pufferfish for the 10th time!"), its picture and
  // when. The stat's words come from #lib/format/labels.ts (owner overrides included). Every null has words.
  import type { MilestoneFeedRow } from "#lib/api/types.ts";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import { iconHref } from "#lib/images.ts";
  import { playerLabel } from "#lib/players/names.ts";
  import { rowPhrase, statHref, statLabel, whenOf, whoOf } from "./helpers.ts";
  import When from "./When.svelte";
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
  const src = $derived(iconHref(m.icon));
  // the stat's link sits on its subject, or on the number when the sentence has no subject ("1st km swum by ...")
  const linkOn = $derived(phrase.parts.some((p) => p.kind === "subject") ? "subject" : "number");
</script>

<div class="li">
  {#if showStat}<span class="pic" title={name}>{#if src}<img {src} alt="" width="20" height="20" loading="lazy" decoding="async" />{/if}</span>{/if}
  <span class="txt">
    <!-- one line on purpose: whitespace between the parts would show up inside the sentence ("time !") -->
    <span>{#each phrase.parts as p, i (i)}{#if p.kind === "player"}{#if who && showPlayer}<PlayerName uuid={who.uuid} name={who.name} />{:else}<span class:c1={!who && !playerName}>{p.text}</span>{/if}{:else if p.kind === linkOn && href}<a {href}>{p.text}</a>{:else if p.kind === "number"}<span class="num">{p.text}</span>{:else}{p.text}{/if}{/each}</span>
    {#if showPlayer && !phrase.hasPlayer}
      <span class="sub">{#if who}<PlayerName uuid={who.uuid} name={who.name} />{:else}First player unknown{/if}</span>
    {/if}
  </span>
  <When {when} />
</div>
