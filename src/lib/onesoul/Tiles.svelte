<script lang="ts">
  // A hairline panel of figures (haiiro's stat panel, `.fx-tiles`): a label, a number, a quiet note. A tile
  // with an `href` is a link. Counts are inside one round or one soul, never summed across scopes.
  export type Tile = { label: string; value: string; note?: string; href?: string };
  let { items }: { items: Tile[] } = $props();
</script>

<div class="stat-panel fx-tiles">
  {#each items as t, i (i)}
    {#if t.href}
      <a href={t.href}><span class="kv_label">{t.label}</span><span class="kv_value num">{t.value}</span>{#if t.note}<span class="note">{t.note}</span>{/if}</a>
    {:else}
      <div><span class="kv_label">{t.label}</span><span class="kv_value num">{t.value}</span>{#if t.note}<span class="note">{t.note}</span>{/if}</div>
    {/if}
  {/each}
</div>
