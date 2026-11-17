<script lang="ts">
  // An item slot: cakeutils' rendered icon in a frame, or a per-kind glyph when there is none (PLAN §2.2).
  import { Box, Package, Rabbit, Sigma, Shapes } from "@lucide/svelte";
  import { iconHref } from "#lib/images.ts";
  let {
    icon,
    kind,
    name,
    size = "md",
    glyph
  }: {
    icon: string | null | undefined;
    /** the catalogue's kind as the API gives it; an unknown one gets the generic glyph */
    kind?: string | null;
    name?: string | null;
    size?: "md" | "lg";
    /** the glyph to show without an icon, for rows that are not a stat subject (an advancement, a biome) */
    glyph?: typeof Box;
  } = $props();
  const glyphs: Record<string, typeof Box> = { block: Box, item: Package, entity: Rabbit, custom: Sigma, other: Shapes };
  const Glyph = $derived(glyph ?? glyphs[kind ?? "other"] ?? Shapes);
  const href = $derived(iconHref(icon));
</script>

<span class="fp-slot" class:fp-slot--lg={size === "lg"} title={name ?? undefined}>
  {#if href}
    <img src={href} alt="" width={size === "lg" ? 48 : 32} height={size === "lg" ? 48 : 32} loading="lazy" decoding="async" />
  {:else}
    <Glyph class="fp-ico fp-slot__glyph" strokeWidth={1.4} />
  {/if}
</span>
