<script lang="ts">
  // Offset paging over `total` rows: where you are, the page numbers, and previous / next. Every link keeps
  // the other search params. Nothing is rendered when everything fits on one page.
  import { group } from "#lib/format/stat-display.ts";
  import { withParams, type UrlLike } from "#lib/url.ts";
  import { pagerSteps } from "./shell.ts";
  let {
    url,
    total,
    limit,
    offset,
    what = "rows",
    prev = "prev",
    next = "next",
    numbers = true
  }: {
    url: UrlLike;
    total: number;
    limit: number;
    offset: number;
    what?: string;
    /** the words on the two links: "newer" / "older" for a feed */
    prev?: string;
    next?: string;
    /** page numbers between the count and the links */
    numbers?: boolean;
  } = $props();
  const at = (o: number) => withParams(url, { offset: o > 0 ? String(o) : null });
  const from = $derived(total === 0 ? 0 : offset + 1);
  const to = $derived(Math.min(total, offset + limit));
  const steps = $derived(numbers ? pagerSteps(total, limit, offset) : []);
</script>

{#if total > limit}
  <nav class="fx-pager" aria-label="Pages">
    <span class="num">{group(from)}–{group(to)} of {group(total)} {what}</span>
    {#if steps.length > 2}
      <span class="seg hide-phone">
        {#each steps as s, i (i)}
          {#if "gap" in s}<span aria-hidden="true">…</span>{:else}<a href={at(s.offset)} aria-current={s.current ? "page" : undefined} aria-label="Page {s.page}">{s.page}</a>{/if}
        {/each}
      </span>
    {/if}
    <span>
      {#if offset > 0}<a class="ink flat" href={at(Math.max(0, offset - limit))} rel="prev">‹ {prev}</a>{:else}<span class="ink flat" aria-disabled="true">‹ {prev}</span>{/if}
      {#if to < total}<a class="ink" href={at(offset + limit)} rel="next">{next} ›</a>{:else}<span class="ink" aria-disabled="true">{next} ›</span>{/if}
    </span>
  </nav>
{/if}
