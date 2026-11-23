<script lang="ts">
  // One row of a Feed: a framed picture (or a face) on the left, what happened and a quiet second line in the
  // middle, when on the right. The frame takes the rarity colour. Children are the first line; `sub` is the
  // second line as a snippet (it usually holds a name in foam and a date).
  import type { Snippet } from "svelte";
  import { iconHref } from "#lib/images.ts";
  import Face from "./Face.svelte";
  import type { Rarity } from "./types.ts";
  let {
    icon,
    uuid,
    rarity,
    href,
    when,
    sub,
    children
  }: {
    /** cakeutils' icon id for the picture; without it (and without `uuid`) the frame is empty */
    icon?: string | null;
    /** show this player's face instead of a picture */
    uuid?: string;
    /** 2 (common) to 6 (the rarest): the frame colour */
    rarity?: Rarity;
    /** makes the whole row a link */
    href?: string;
    /** the formatted moment ("4 Nov 2026", "17:44 CET"); empty for "reached before tracking began" */
    when?: string;
    sub?: Snippet;
    children: Snippet;
  } = $props();
  const src = $derived(iconHref(icon));
</script>

{#snippet body()}
  {#if uuid}<Face {uuid} size="sm" />{:else}<span class="pic{rarity ? ` r${rarity}` : ''}">{#if src}<img {src} alt="" width="20" height="20" loading="lazy" decoding="async" />{/if}</span>{/if}
  <span class="txt"><span>{@render children()}</span>{#if sub}<span class="sub">{@render sub()}</span>{/if}</span>
  {#if when}<span class="when">{when}</span>{/if}
{/snippet}

{#if href}<a class="li" {href}>{@render body()}</a>{:else}<div class="li">{@render body()}</div>{/if}
