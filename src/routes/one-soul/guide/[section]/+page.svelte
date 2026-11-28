<script lang="ts">
  // One section of the guide: its entries in full, and the way to the sections before and after it.
  import AsOf from "#lib/design/AsOf.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import GuideEntry from "#lib/onesoul/guide/GuideEntry.svelte";
  import GuideGate from "#lib/onesoul/guide/GuideGate.svelte";
  import { itemNames, recipeMap, valueTexts } from "#lib/onesoul/guide/text.ts";
  let { data } = $props();
  const g = $derived(data.guide);
  const values = $derived(g ? valueTexts(g) : new Map<string, string>());
  const names = $derived(g ? itemNames(g) : new Map<string, string>());
  const recipes = $derived(g ? recipeMap(g) : new Map());
  const icons = $derived((data.icons ?? {}) as Record<string, string>);
</script>

<PageHead path="~/one-soul/guide" cmd="cat" args="{data.section?.id ?? 'guide'}.md" title={data.section?.title ?? "guide"}>
  <OsTabs />
</PageHead>

<GuideGate has={!!g && !!data.section} why={data.why} stale={data.stale} at={data.asOf}>
  <Window path="~/one-soul/guide" args="--{data.section?.id}">
    <WindowHead title={data.section?.title ?? ""}>{#if data.asOf}<AsOf at={data.asOf} stale={data.stale} />{/if}</WindowHead>
    {#each data.entries ?? [] as e (e.id)}
      <GuideEntry entry={e} {names} {icons} {values} {recipes} />
    {/each}
  </Window>
  <nav class="gd-nav" aria-label="Guide sections">
    {#if data.prev}<a class="lnk" href="/one-soul/guide/{data.prev.id}" rel="prev">&larr; {data.prev.title}</a>{:else}<span></span>{/if}
    <a class="lnk" href="/one-soul/guide">All sections</a>
    {#if data.next}<a class="lnk" href="/one-soul/guide/{data.next.id}" rel="next">{data.next.title} &rarr;</a>{:else}<span></span>{/if}
  </nav>
</GuideGate>

<style>
  .gd-nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px 24px;
  }
</style>
