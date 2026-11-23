<script lang="ts">
  // The table twin: an fx-table from columns and rows. Numbers right-aligned, tabular. A wide table scrolls
  // inside its own box, never the page.
  import type { DataTableProps } from "./types.ts";
  let { columns, rows, caption }: DataTableProps = $props();
</script>

<div class="fx-scroll">
  <table class="fx-table">
    {#if caption}<caption class="visually-hidden">{caption}</caption>{/if}
    <thead><tr>{#each columns as c (c.key)}<th class={c.num ? "r" : ""} scope="col">{c.label}</th>{/each}</tr></thead>
    <tbody>
      {#each rows as r, i (i)}
        <tr>{#each columns as c (c.key)}<td class={c.num ? "r" : ""}>{r[c.key] ?? "—"}</td>{/each}</tr>
      {/each}
    </tbody>
  </table>
</div>
