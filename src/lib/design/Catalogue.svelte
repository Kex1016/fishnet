<script lang="ts">
  // A grid of things to open (stat subjects, boards, servers): a small framed picture, the name, a quiet
  // count on the right.
  import { iconHref } from "#lib/images.ts";
  import type { CatalogueItem } from "./types.ts";
  let { items, pic = false, label }: { items: CatalogueItem[]; /** show the picture frame on every item */ pic?: boolean; label?: string } = $props();
</script>

<nav class="fx-cat" aria-label={label}>
  {#each items as it (it.href)}
    {@const src = iconHref(it.icon)}
    <a href={it.href} aria-current={it.current ? "page" : undefined}>
      <span>{#if pic || src}<span class="pic">{#if src}<img {src} alt="" width="12" height="12" loading="lazy" decoding="async" />{/if}</span>{/if}{it.label}</span>
      {#if it.meta}<span class="meta">{it.meta}</span>{/if}
    </a>
  {/each}
</nav>
