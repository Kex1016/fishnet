<script lang="ts">
  // A card with a header (title, subtitle, a readout on the right) and a body. Charts live in these.
  import type { Snippet } from "svelte";
  let {
    title,
    href,
    sub,
    readout,
    foot,
    children
  }: { title?: string; href?: string; sub?: string; readout?: Snippet; foot?: Snippet; children: Snippet } = $props();
</script>

<section class="fp-card">
  {#if title || readout}
    <header class="fp-card__head">
      <div>
        {#if title}<h2 class="fp-card__title">{#if href}<a {href}>{title}</a>{:else}{title}{/if}</h2>{/if}
        {#if sub}<div class="fp-card__sub">{sub}</div>{/if}
      </div>
      {#if readout}<div class="fp-card__readout">{@render readout()}</div>{/if}
    </header>
  {/if}
  <div class="fp-card__body">{@render children()}</div>
  {#if foot}<footer class="fp-card__foot">{@render foot()}</footer>{/if}
</section>
