<script lang="ts">
  // Offset paging over `total` rows: previous / next links that keep the other search params.
  import { group } from "#lib/format/stat-display.ts";
  import { withParams, type UrlLike } from "#lib/url.ts";
  let { url, total, limit, offset, what = "rows" }: { url: UrlLike; total: number; limit: number; offset: number; what?: string } = $props();
  const at = (o: number) => withParams(url, { offset: o > 0 ? String(o) : null });
  const from = $derived(total === 0 ? 0 : offset + 1);
  const to = $derived(Math.min(total, offset + limit));
</script>

{#if total > limit}
  <nav class="fp-pager" aria-label="Pages">
    <span class="fp-pager__info">{group(from)}–{group(to)} of {group(total)} {what}</span>
    <span class="fp-chips">
      {#if offset > 0}<a class="fp-chip" href={at(Math.max(0, offset - limit))} rel="prev">Previous</a>{:else}<span class="fp-chip" aria-disabled="true" style="opacity:.5">Previous</span>{/if}
      {#if to < total}<a class="fp-chip" href={at(offset + limit)} rel="next">Next</a>{:else}<span class="fp-chip" aria-disabled="true" style="opacity:.5">Next</span>{/if}
    </span>
  </nav>
{/if}
