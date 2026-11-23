<script lang="ts">
  // A picture in a frame: cakeutils' rendered icon, or a dithered square when there is none (PLAN §2.2).
  // The frame takes the rarity colour when one is given (advancement frames, milestone tiers).
  import { iconHref } from "#lib/images.ts";
  import type { Rarity } from "./types.ts";
  let {
    icon,
    name,
    size = "md",
    rarity
  }: {
    icon: string | null | undefined;
    name?: string | null;
    size?: "md" | "lg";
    /** 2 (common) to 6 (the rarest): the frame colour, classes .r2 to .r6 */
    rarity?: Rarity;
  } = $props();
  const href = $derived(iconHref(icon));
</script>

<span class="fx-slot{size === 'lg' ? ' lg' : ''}{rarity ? ` r${rarity}` : ''}" title={name ?? undefined}>
  {#if href}
    <img src={href} alt="" width={size === "lg" ? 48 : 32} height={size === "lg" ? 48 : 32} loading="lazy" decoding="async" />
  {:else}
    <span class="dith lo"></span>
  {/if}
</span>
