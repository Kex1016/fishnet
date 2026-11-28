<script lang="ts">
  // The guide's contents: every section with its entries as links. The numbers on the section pages are the
  // server's own settings, read live.
  import AsOf from "#lib/design/AsOf.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
  import GuideGate from "#lib/onesoul/guide/GuideGate.svelte";
  import { groupBySection } from "#lib/onesoul/guide/text.ts";
  let { data } = $props();
  const groups = $derived(data.guide ? groupBySection(data.guide) : []);
</script>

<PageHead path="~/one-soul" cmd="cat" args="guide.md" title="guide" lede="How One Soul at a Time works: the run, death and graves, Borrowed Time, and the Nether and the End. The numbers are the server's own settings, read live.">
  <OsTabs />
</PageHead>

<GuideGate has={!!data.guide} why={data.why} stale={data.stale} at={data.asOf}>
  <div class="fx-grid">
    {#each groups as { section, entries } (section.id)}
      <Window path="~/one-soul/guide" args="--{section.id}" tag="nav" label={section.title}>
        <WindowHead title={section.title} href="/one-soul/guide/{section.id}">{#if data.asOf && data.stale}<AsOf at={data.asOf} stale />{/if}</WindowHead>
        <ul class="gd-toc">
          {#each entries as e (e.id)}<li><a class="lnk" href="/one-soul/guide/{section.id}#{e.id}">{e.title}</a></li>{/each}
        </ul>
      </Window>
    {/each}
  </div>
</GuideGate>

<style>
  .gd-toc {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
</style>
