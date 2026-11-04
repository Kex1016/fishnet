<script lang="ts">
  // The table twin: an fp-table from columns and rows. Numbers right-aligned, tabular.
  import type { DataTableProps } from "./types.ts";
  let { columns, rows, caption }: DataTableProps = $props();
</script>

<div class="fp-table__wrap">
  <table class="fp-table">
    {#if caption}<caption class="visually-hidden">{caption}</caption>{/if}
    <thead><tr>{#each columns as c (c.key)}<th class={c.num ? "num" : ""} scope="col">{c.label}</th>{/each}</tr></thead>
    <tbody>
      {#each rows as r, i (i)}
        <tr>{#each columns as c (c.key)}<td class={c.num ? "num" : ""}>{r[c.key] ?? "—"}</td>{/each}</tr>
      {/each}
    </tbody>
  </table>
</div>
