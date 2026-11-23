<script lang="ts">
  // The key/value sheet (a character sheet): quiet upper-case labels on the left, values on the right.
  // Pass `rows` for plain text values, or children (KV components) when a value needs markup.
  import type { Snippet } from "svelte";
  import type { SheetRow } from "./types.ts";
  let {
    rows,
    children
  }: { rows?: SheetRow[]; children?: Snippet } = $props();
</script>

<div class="fx-sheet">
  {#if rows}{#each rows as r (r.label)}<span class="kv_label">{r.label}</span><span class={[r.num ? "num" : "", r.ink ?? ""].filter(Boolean).join(" ") || undefined}>{r.value}</span>{/each}{/if}
  {#if children}{@render children()}{/if}
</div>
